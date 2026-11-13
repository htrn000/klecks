import type { TDeserializedKlStorageProject, TKlProject } from '../kl-types';
import type { TKlStorageProjectRead, TKlStorageProjectWrite } from './project-converter';

export type TRemoteProjectMeta = { id: string; name: string; updatedAt: number; size: number; thumbnailUrl: string };
export type TServerSaveDecision = { action: 'update'; project: TRemoteProjectMeta } | { action: 'create' };
type TRemoteRecord = TRemoteProjectMeta & { project: TKlStorageProjectWrite; blobs: Record<string, string> };
type TConverter = {
    createStorageProject(project: TKlProject): Promise<TKlStorageProjectWrite>;
    readStorageProject(record: TKlStorageProjectRead): Promise<TDeserializedKlStorageProject>;
};
type TBlobMarker = { $blob: string; $kind: 'blob' | 'bytes' };

export function getServerSaveDecision(projectId: string, projects: readonly TRemoteProjectMeta[]): TServerSaveDecision {
    const project = projects.find((item) => item.id === projectId);
    return project ? { action: 'update', project } : { action: 'create' };
}

export function createNewServerProjectId(currentId: string, generateId: () => string): string {
    let id = generateId();
    while (id === currentId) id = generateId();
    return id;
}

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}
function fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** Turns binary project fields into JSON-safe markers while keeping the converter's record shape. */
export async function encodeRemoteRecord(record: TKlStorageProjectWrite): Promise<{ project: Record<string, unknown>; blobs: Record<string, string> }> {
    const blobs: Record<string, string> = {};
    let next = 0;
    const visit = async (value: unknown): Promise<unknown> => {
        if (value instanceof Blob) {
            const id = `b${next++}`;
            blobs[id] = toBase64(new Uint8Array(await value.arrayBuffer()));
            return { $blob: id, $kind: 'blob' } satisfies TBlobMarker;
        }
        if (value instanceof Uint8Array) {
            const id = `b${next++}`;
            blobs[id] = toBase64(value);
            return { $blob: id, $kind: 'bytes' } satisfies TBlobMarker;
        }
        if (Array.isArray(value)) return Promise.all(value.map(visit));
        if (value && typeof value === 'object') {
            const result: Record<string, unknown> = {};
            for (const [key, item] of Object.entries(value)) result[key] = await visit(item);
            return result;
        }
        return value;
    };
    return { project: await visit(record) as Record<string, unknown>, blobs };
}

export function decodeRemoteRecord(project: Record<string, unknown>, blobs: Record<string, string>): TKlStorageProjectRead {
    const visit = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(visit);
        if (value && typeof value === 'object') {
            const marker = value as Partial<TBlobMarker>;
            if (typeof marker.$blob === 'string') {
                const encoded = blobs[marker.$blob];
                if (encoded === undefined) throw new Error('Remote project is missing a blob');
                const bytes = fromBase64(encoded);
                if (marker.$kind === 'bytes') return bytes;
                const blobBytes = new Uint8Array(bytes.length);
                blobBytes.set(bytes);
                return new Blob([blobBytes.buffer], { type: 'image/png' });
            }
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
        }
        return value;
    };
    return visit(project) as TKlStorageProjectRead;
}

function isNetworkFailure(error: unknown): boolean {
    return error instanceof TypeError &&
        /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(error.message);
}

function isNotFound(error: unknown): boolean {
    return error instanceof Error && /(?:\(|\s)404\)?$/.test(error.message);
}

/** Remote counterpart to ProjectStore; browser storage remains an independent store. */
export class RemoteProjectStore {
    private readonly fetcher: typeof fetch;
    private readonly converter?: TConverter;
    private currentId: string | undefined;

    constructor(fetcher: typeof fetch = fetch, converter?: TConverter) {
        this.fetcher = fetcher.bind(globalThis);
        this.converter = converter;
    }

    async list(): Promise<TRemoteProjectMeta[]> {
        const response = await this.fetcher('/api/projects');
        if (!response.ok) throw new Error(`Server project list failed (${response.status})`);
        return await response.json() as TRemoteProjectMeta[];
    }

    async isAvailable(): Promise<boolean> {
        try { await this.list(); return true; } catch (error) {
            if (!isNetworkFailure(error) && !isNotFound(error)) {
                console.warn('Server project availability probe failed', error);
            }
            return false;
        }
    }

    async store(project: TKlProject, name = 'Untitled', id = project.projectId): Promise<TRemoteProjectMeta> {
        const converter = this.converter ?? (await import('./project-converter')).ProjectConverter;
        const converted = await converter.createStorageProject(project);
        const packed = await encodeRemoteRecord(converted);
        const response = await this.fetcher(`/api/projects/${encodeURIComponent(id)}`, {
            method: 'PUT', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, project: packed.project, blobs: packed.blobs }),
        });
        if (!response.ok) throw new Error(`Server project save failed (${response.status})`);
        this.currentId = id;
        return await response.json() as TRemoteProjectMeta;
    }

    async read(id = this.currentId): Promise<TDeserializedKlStorageProject | undefined> {
        if (!id) return undefined;
        const response = await this.fetcher(`/api/projects/${encodeURIComponent(id)}`);
        if (response.status === 404) return undefined;
        if (!response.ok) throw new Error(`Server project read failed (${response.status})`);
        const record = await response.json() as TRemoteRecord;
        this.currentId = record.id;
        const converter = this.converter ?? (await import('./project-converter')).ProjectConverter;
        return await converter.readStorageProject(decodeRemoteRecord(record.project as unknown as Record<string, unknown>, record.blobs));
    }

    async clear(id = this.currentId): Promise<void> {
        if (!id) return;
        const response = await this.fetcher(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) throw new Error(`Server project delete failed (${response.status})`);
        if (id === this.currentId) this.currentId = undefined;
    }

    async rename(id: string, name: string): Promise<TRemoteProjectMeta> {
        const response = await this.fetcher(`/api/projects/${encodeURIComponent(id)}`, {
            method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
        });
        if (!response.ok) throw new Error(`Server project rename failed (${response.status})`);
        return await response.json() as TRemoteProjectMeta;
    }

    thumbnailUrl(id: string): string { return `/api/projects/${encodeURIComponent(id)}/thumbnail`; }
}
