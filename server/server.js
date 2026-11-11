import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const DEFAULT_MAX_REQUEST_BYTES = 512 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidProjectId(id) {
    return typeof id === 'string' && ID_PATTERN.test(id);
}

function sendJson(response, status, value) {
    const body = Buffer.from(JSON.stringify(value));
    response.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': body.length,
        'cache-control': 'no-store',
    });
    response.end(body);
}

function fail(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function readJsonBody(request, limit) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > limit) throw fail(413, `Request exceeds the ${limit} byte limit`);
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        throw fail(400, 'Request body must contain valid JSON');
    }
}

function collectBlobRefs(value, refs = new Set()) {
    if (Array.isArray(value)) {
        value.forEach((item) => collectBlobRefs(item, refs));
    } else if (value && typeof value === 'object') {
        if (typeof value.$blob === 'string') refs.add(value.$blob);
        else Object.values(value).forEach((item) => collectBlobRefs(item, refs));
    }
    return refs;
}

function remapBlobRefs(value, references) {
    if (Array.isArray(value)) return value.map((item) => remapBlobRefs(item, references));
    if (value && typeof value === 'object') {
        if (typeof value.$blob === 'string') {
            const ref = references.get(value.$blob);
            if (!ref) throw fail(400, 'Project references a missing blob');
            return { ...value, $blob: ref };
        }
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapBlobRefs(item, references)]));
    }
    return value;
}

async function readProjectDirectory(dataDir, id) {
    try {
        return JSON.parse(await readFile(path.join(dataDir, id, 'project.json'), 'utf8'));
    } catch (error) {
        if (error?.code === 'ENOENT') return undefined;
        throw error;
    }
}

async function commitProject(dataDir, id, name, input) {
    if (!input || typeof input !== 'object' || !input.project || typeof input.project !== 'object' ||
        !input.blobs || typeof input.blobs !== 'object' || Array.isArray(input.blobs)) {
        throw fail(400, 'Project and blobs are required');
    }
    const blobEntries = Object.entries(input.blobs);
    const refs = collectBlobRefs(input.project);
    if ([...refs].some((ref) => !Object.hasOwn(input.blobs, ref)) || blobEntries.some(([ref]) => !refs.has(ref))) {
        throw fail(400, 'Project blob references do not match uploaded blobs');
    }
    const referenceMap = new Map();
    const decodedBlobs = new Map();
    let blobBytesSize = 0;
    for (const [clientRef, encoded] of blobEntries) {
        if (!isValidProjectId(clientRef) || typeof encoded !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
            throw fail(400, 'Blob data is invalid');
        }
        const bytes = Buffer.from(encoded, 'base64');
        const ref = randomUUID();
        referenceMap.set(clientRef, ref);
        decodedBlobs.set(ref, bytes);
        blobBytesSize += bytes.length;
    }
    const project = remapBlobRefs(input.project, referenceMap);
    const size = Buffer.byteLength(JSON.stringify(project)) + blobBytesSize;
    const updatedAt = Date.now();
    const safeName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 200) : 'Untitled';
    const dir = path.join(dataDir, id);
    const blobDir = path.join(dir, 'blobs');
    await mkdir(blobDir, { recursive: true });

    for (const [ref, bytes] of decodedBlobs) {
        const target = path.join(blobDir, `${ref}.bin`);
        const temporary = `${target}.tmp-${randomUUID()}`;
        await writeFile(temporary, bytes, { flag: 'wx' });
        await rename(temporary, target);
    }

    const record = { id, name: safeName, updatedAt, size, project };
    const projectPath = path.join(dir, 'project.json');
    const temporaryProjectPath = `${projectPath}.tmp-${randomUUID()}`;
    await writeFile(temporaryProjectPath, JSON.stringify(record), { flag: 'wx' });
    await rename(temporaryProjectPath, projectPath);

    // The metadata rename is the commit point. Old blobs can now be removed safely.
    const keep = new Set([...decodedBlobs.keys()].map((ref) => `${ref}.bin`));
    for (const file of await readdir(blobDir)) {
        if (!keep.has(file) && !file.includes('.tmp-')) await rm(path.join(blobDir, file), { force: true });
    }
    return record;
}

export function createApiServer(options = {}) {
    const dataDir = path.resolve(options.dataDir ?? process.env.DATA_DIR ?? '/data');
    const maxRequestBytes = options.maxRequestBytes ?? Number(process.env.MAX_REQUEST_BYTES || DEFAULT_MAX_REQUEST_BYTES);
    if (!Number.isSafeInteger(maxRequestBytes) || maxRequestBytes < 1) throw new Error('MAX_REQUEST_BYTES must be a positive integer');

    return http.createServer(async (request, response) => {
        try {
            const url = new URL(request.url ?? '/', 'http://localhost');
            const parts = url.pathname.split('/').filter(Boolean);
            if (parts[0] !== 'api' || parts[1] !== 'projects') throw fail(404, 'Not found');
            if (parts.length === 2 && request.method === 'GET') {
                await mkdir(dataDir, { recursive: true });
                const projects = [];
                for (const entry of await readdir(dataDir, { withFileTypes: true })) {
                    if (!entry.isDirectory() || !isValidProjectId(entry.name)) continue;
                    const record = await readProjectDirectory(dataDir, entry.name);
                    if (record) projects.push({
                        id: record.id,
                        name: record.name,
                        updatedAt: record.updatedAt,
                        size: record.size,
                        thumbnailUrl: `/api/projects/${encodeURIComponent(record.id)}/thumbnail`,
                    });
                }
                projects.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
                return sendJson(response, 200, projects);
            }
            if (parts.length < 3 || parts.length > 4) throw fail(404, 'Not found');
            let id;
            try { id = decodeURIComponent(parts[2]); } catch { throw fail(400, 'Invalid project id'); }
            if (!isValidProjectId(id)) throw fail(400, 'Invalid project id');
            if (parts[3] === 'thumbnail' && request.method === 'GET') {
                const record = await readProjectDirectory(dataDir, id);
                if (!record) throw fail(404, 'Project not found');
                const thumbnailRef = record.project?.thumbnail?.$blob;
                if (!thumbnailRef || !isValidProjectId(thumbnailRef)) throw fail(404, 'Thumbnail not found');
                const file = path.join(dataDir, id, 'blobs', `${thumbnailRef}.bin`);
                const info = await stat(file).catch(() => undefined);
                if (!info?.isFile()) throw fail(404, 'Thumbnail not found');
                response.writeHead(200, { 'content-type': 'image/png', 'content-length': info.size, 'cache-control': 'no-store' });
                return createReadStream(file).pipe(response);
            }
            if (parts.length !== 3) throw fail(404, 'Not found');
            if (request.method === 'GET') {
                const record = await readProjectDirectory(dataDir, id);
                if (!record) throw fail(404, 'Project not found');
                const refs = collectBlobRefs(record.project);
                const blobs = {};
                for (const ref of refs) {
                    if (!isValidProjectId(ref)) throw fail(500, 'Stored project contains an invalid blob reference');
                    blobs[ref] = (await readFile(path.join(dataDir, id, 'blobs', `${ref}.bin`))).toString('base64');
                }
                return sendJson(response, 200, { ...record, blobs });
            }
            if (request.method === 'PUT') {
                const body = await readJsonBody(request, maxRequestBytes);
                const record = await commitProject(dataDir, id, body.name, body);
                return sendJson(response, 200, { id: record.id, name: record.name, updatedAt: record.updatedAt, size: record.size });
            }
            if (request.method === 'DELETE') {
                const record = await readProjectDirectory(dataDir, id);
                if (!record) throw fail(404, 'Project not found');
                await rm(path.join(dataDir, id), { recursive: true, force: true });
                return sendJson(response, 200, { id });
            }
            throw fail(405, 'Method not allowed');
        } catch (error) {
            const status = Number.isInteger(error?.status) ? error.status : 500;
            if (!response.headersSent) sendJson(response, status, { error: error?.message || 'Internal server error' });
            else response.destroy();
        }
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || '0.0.0.0';
    createApiServer().listen(port, host, () => console.log(`Klecks project API listening on ${host}:${port}`));
}
