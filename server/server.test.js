import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApiServer } from './server.js';

async function fixture(t, maxRequestBytes) {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'klecks-api-'));
    const server = createApiServer({ dataDir, maxRequestBytes });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => { await new Promise((resolve) => server.close(resolve)); await rm(dataDir, { recursive: true, force: true }); });
    return { dataDir, base };
}
const png = 'aGVsbG8=';
const payload = (name) => ({ name, project: { id: 1, projectId: 'p', timestamp: 1, width: 1, height: 1, thumbnail: { $blob: 'thumb', $kind: 'blob' }, layers: [{ blob: { $blob: 'thumb', $kind: 'blob' } }] }, blobs: { thumb: png } });

test('CRUD round-trip and thumbnail', async (t) => {
    const { base } = await fixture(t);
    assert.equal((await fetch(`${base}/api/projects/a`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload('A')) })).status, 200);
    const record = await (await fetch(`${base}/api/projects/a`)).json();
    assert.equal(record.name, 'A');
    assert.equal(Buffer.from(record.blobs[record.project.thumbnail.$blob], 'base64').toString(), 'hello');
    assert.equal((await fetch(`${base}${record.project.thumbnail.$blob ? '/api/projects/a/thumbnail' : ''}`)).status, 200);
    assert.equal((await fetch(`${base}/api/projects/a`, { method: 'DELETE' })).status, 200);
    assert.equal((await fetch(`${base}/api/projects/a`)).status, 404);
});

test('list is newest first', async (t) => {
    const { base } = await fixture(t);
    for (const id of ['first', 'second']) {
        await fetch(`${base}/api/projects/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload(id)) });
        await new Promise((resolve) => setTimeout(resolve, 3));
    }
    assert.deepEqual((await (await fetch(`${base}/api/projects`)).json()).map((x) => x.id), ['second', 'first']);
});

test('rejects traversal and oversized bodies without replacing the old project', async (t) => {
    const { base } = await fixture(t, 1000);
    assert.equal((await fetch(`${base}/api/projects/%2e%2e%2fsecret`)).status, 400);
    await fetch(`${base}/api/projects/a`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload('before')) });
    const response = await fetch(`${base}/api/projects/a`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload('after'), extra: 'x'.repeat(2000) }) });
    assert.equal(response.status, 413);
    assert.equal((await (await fetch(`${base}/api/projects/a`)).json()).name, 'before');
});

test('writes use atomic rename and leave no temporary files after success', async (t) => {
    const { base, dataDir } = await fixture(t);
    await fetch(`${base}/api/projects/a`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload('A')) });
    const files = await readdir(path.join(dataDir, 'a'));
    assert.deepEqual(files.sort(), ['blobs', 'project.json']);
    assert.equal(JSON.parse(await readFile(path.join(dataDir, 'a/project.json'), 'utf8')).name, 'A');
});
