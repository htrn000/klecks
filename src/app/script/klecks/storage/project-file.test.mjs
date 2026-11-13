import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRemoteRecord } from './remote-project-store.ts';
import { encodeProjectFile, parseProjectFile } from './project-file.ts';

test('project file round-trip preserves project fields, base-role frames, and blob bytes', async () => {
    const record = {
        id: 1,
        projectId: 'project-id',
        timestamp: 123,
        width: 2,
        height: 1,
        thumbnail: new Blob([new Uint8Array([9, 8])], { type: 'image/png' }),
        layers: [{ name: 'Layer 1', isVisible: true, opacity: 1, mixModeStr: 'source-over', hasClipping: false, blob: new Blob([new Uint8Array([1])], { type: 'image/png' }) }],
        frames: {
            width: 2,
            height: 1,
            activeFrameIndex: 0,
            frames: [{ id: 'frame-1', layers: [{ id: 'base', role: 'frame-base', name: 'Original', isVisible: true, opacity: 0.6, mixModeStr: 'source-over', hasClipping: false, blob: new Blob([new Uint8Array([2, 3])], { type: 'image/png' }) }] }],
            baseLayer: { visible: true, opacity: 0.6 },
        },
        palette: { colors: [{ r: 10, g: 20, b: 30 }] },
    };
    const text = await encodeProjectFile(record, 'Project title', 456);
    const parsed = parseProjectFile(text);
    const decoded = decodeRemoteRecord(parsed.project, parsed.blobs);

    assert.equal(parsed.name, 'Project title');
    assert.equal(parsed.savedAt, 456);
    assert.equal(decoded.projectId, record.projectId);
    assert.deepEqual(decoded.palette, record.palette);
    assert.equal(decoded.frames.frames[0].layers[0].role, 'frame-base');
    assert.deepEqual([...new Uint8Array(await decoded.frames.frames[0].layers[0].blob.arrayBuffer())], [2, 3]);
    assert.deepEqual([...new Uint8Array(await decoded.thumbnail.arrayBuffer())], [9, 8]);
});

test('project file parser rejects malformed JSON with its exact message', () => {
    assert.throws(() => parseProjectFile('{'), { message: 'Invalid project file JSON' });
});

test('project file parser rejects a different format with its exact message', () => {
    assert.throws(() => parseProjectFile(JSON.stringify({ format: 'other', version: 1 })), { message: 'Not a Klecks project file' });
});

test('project file parser rejects a different version with its exact message', () => {
    assert.throws(() => parseProjectFile(JSON.stringify({ format: 'klecks-project', version: 2 })), { message: 'Unsupported project file version' });
});
