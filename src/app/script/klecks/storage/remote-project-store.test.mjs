import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRemoteRecord, encodeRemoteRecord, RemoteProjectStore } from './remote-project-store.ts';

test('remote binary record encoding preserves Blob and Uint8Array fields', async () => {
    const record = { thumbnail: new Blob([new Uint8Array([1, 2, 3])]), frames: { sheet: { trailingPixels: new Uint8Array([8, 9]) } } };
    const packed = await encodeRemoteRecord(record);
    const decoded = decodeRemoteRecord(packed.project, packed.blobs);
    assert.deepEqual([...new Uint8Array(await decoded.thumbnail.arrayBuffer())], [1, 2, 3]);
    assert.deepEqual([...decoded.frames.sheet.trailingPixels], [8, 9]);
});

test('RemoteProjectStore save/list/read/delete uses converter and JSON-safe blobs', async () => {
    const calls = [];
    let stored;
    const fetcher = async (url, options = {}) => {
        calls.push([url, options.method || 'GET']);
        if (options.method === 'PUT') {
            stored = JSON.parse(options.body);
            return new Response(JSON.stringify({ id: 'p-1', name: 'P', updatedAt: 1, size: 5, thumbnailUrl: '/thumb' }), { status: 200 });
        }
        if (options.method === 'DELETE') return new Response('{}', { status: 200 });
        if (url === '/api/projects') return new Response('[]', { status: 200 });
        return new Response(JSON.stringify({ id: 'p-1', name: 'P', updatedAt: 1, size: 5, project: stored.project, blobs: stored.blobs }), { status: 200 });
    };
    const converter = {
        createStorageProject: async (project) => ({ id: 1, projectId: project.projectId, thumbnail: new Blob(['t']), layers: [] }),
        readStorageProject: async (record) => ({ project: record, timestamp: 1, thumbnail: null }),
    };
    const store = new RemoteProjectStore(fetcher, converter);
    await store.store({ projectId: 'p-1' }, 'P');
    assert.equal((await store.list()).length, 0);
    const restored = await store.read('p-1');
    assert.equal(restored.project.projectId, 'p-1');
    assert.equal((await store.clear('p-1')), undefined);
    assert.deepEqual(calls.map((x) => x[1]), ['PUT', 'GET', 'GET', 'DELETE']);
});

test('fetch is invoked with a valid global receiver', async () => {
    let receiver;
    const methodStyleFetch = async function () {
        receiver = this;
        if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
        return new Response('[]', { status: 200 });
    };
    const store = new RemoteProjectStore(methodStyleFetch);
    assert.equal(await store.isAvailable(), true);
    assert.equal(receiver, globalThis);
});

test('availability warns on client errors but not missing routes or network failures', async () => {
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
        const notFound = new RemoteProjectStore(async () => new Response('', { status: 404 }));
        const offline = new RemoteProjectStore(async () => { throw new TypeError('fetch failed'); });
        const broken = new RemoteProjectStore(async () => { throw new TypeError('Illegal invocation'); });
        assert.equal(await notFound.isAvailable(), false);
        assert.equal(await offline.isAvailable(), false);
        assert.equal(warnings.length, 0);
        assert.equal(await broken.isAvailable(), false);
        assert.equal(warnings.length, 1);
        assert.match(warnings[0][0], /availability probe failed/);
        assert.equal(warnings[0][1].message, 'Illegal invocation');
    } finally {
        console.warn = originalWarn;
    }
});
