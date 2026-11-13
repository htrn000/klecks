import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addFrame,
    copyLayersToFrames,
    createFrameSet,
    deleteFrame,
    duplicateFrame,
    FRAME_SET_MEMORY_BUDGET_BYTES,
    getExportableFrameLayers,
    moveFrame,
    selectFrame,
} from './frame-set.ts';

function makeFrames(count, layersPerFrame = 1) {
    return Array.from({ length: count }, (_, i) => ({
        id: `frame-${i}`,
        layers: Array.from({ length: layersPerFrame }, (_, j) => ({
            id: `layer-${i}-${j}`,
            image: `opaque-${i}-${j}`,
        })),
    }));
}

const stripCases = [
    { name: 'P5 strip 1', width: 600, height: 500, count: 24, tail: 0, sheetWidth: 14400 },
    { name: 'P5 strip 2 with tail', width: 600, height: 510, count: 28, tail: 28, sheetWidth: 16828 },
    { name: 'P5 strip 3', width: 500, height: 500, count: 24, tail: 0, sheetWidth: 12000 },
];

for (const strip of stripCases) {
    test(`${strip.name} preserves exact horizontal sheet geometry`, () => {
        const result = createFrameSet({
            width: strip.width,
            height: strip.height,
            frames: makeFrames(strip.count),
            sheet: {
                cellWidth: strip.width,
                cellHeight: strip.height,
                frameCount: strip.count,
                trailingPaddingPx: strip.tail,
                sheetWidth: strip.sheetWidth,
                sheetHeight: strip.height,
            },
        });
        assert.equal(result.ok, true);
        assert.equal(result.value.sheet.sheetWidth, strip.sheetWidth);
        assert.equal(result.value.sheet.trailingPaddingPx, strip.tail);
    });
}

for (const dimension of ['width', 'height']) {
    for (const [label, value] of [
        ['zero', 0],
        ['negative', -3],
        ['non-integer', 2.5],
    ]) {
        test(`rejects ${label} ${dimension} with a typed error`, () => {
            const result = createFrameSet({
                width: 10,
                height: 10,
                [dimension]: value,
                frames: makeFrames(1),
            });
            assert.equal(result.ok, false);
            assert.equal(result.error.code, 'invalid-size');
        });
    }
}

test('rejects duplicate frame ids', () => {
    const result = createFrameSet({
        width: 10,
        height: 10,
        frames: [makeFrames(1)[0], makeFrames(1)[0]],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'duplicate-frame-id');
});

test('rejects invalid sheet geometry without throwing', () => {
    const result = createFrameSet({
        width: 10,
        height: 10,
        frames: makeFrames(1),
        sheet: {
            cellWidth: 10,
            cellHeight: 10,
            frameCount: 1,
            trailingPaddingPx: -1,
            sheetWidth: 9,
            sheetHeight: 10,
        },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'invalid-sheet-geometry');
});

test('rejects aggregate frame storage over the 2 GiB budget', () => {
    const width = 4096;
    const height = 4096;
    const layersPerFrame = 16;
    assert.equal(width * height * 4 * layersPerFrame, 1024 * 1024 * 1024);
    assert.equal(FRAME_SET_MEMORY_BUDGET_BYTES, 2 * 1024 * 1024 * 1024);
    const result = createFrameSet({
        width,
        height,
        frames: makeFrames(3, layersPerFrame),
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'frame-set-memory-limit');
    assert.equal(result.error.frameIndex, 2);
});

test('base appearance is shared across frames and remains stable through A-B-A selection', () => {
    const baseA = { rgba: new Uint8Array([1, 2, 3, 255]), thumbnail: 'data:a' };
    const baseB = { rgba: new Uint8Array([4, 5, 6, 255]), thumbnail: 'data:b' };
    const result = createFrameSet({
        width: 1,
        height: 1,
        baseLayer: { visible: true, opacity: 0.8 },
        frames: [
            { id: 'a', thumbnail: baseA.thumbnail, layers: [{ id: 'ba', image: baseA, role: 'frame-base', isVisible: false, opacity: 1 }] },
            { id: 'b', thumbnail: baseB.thumbnail, layers: [{ id: 'bb', image: baseB, role: 'frame-base', isVisible: true, opacity: 0.1 }] },
        ],
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.frames.map((frame) => frame.layers[0].isVisible), [true, true]);
    assert.deepEqual(result.value.frames.map((frame) => frame.layers[0].opacity), [0.8, 0.8]);
    const original = structuredClone(result.value.frames[0]);
    let state = { frameSet: result.value, activeFrameIndex: 0 };
    state = selectFrame(state, 1).value;
    state = selectFrame(state, 0).value;
    assert.deepEqual(state.frameSet.frames[0], original);
});

test('export omits the frame base but includes its editable duplicate', () => {
    const frame = { id: 'a', layers: [
        { id: 'base', role: 'frame-base', image: 'original' },
        { id: 'copy', image: 'editable-copy' },
        { id: 'ink', image: 'editable-ink' },
    ] };
    assert.deepEqual(getExportableFrameLayers(frame.layers).map((layer) => layer.image), ['editable-copy', 'editable-ink']);
});

test('frame-base role is limited to one layer at index zero', () => {
    for (const layers of [
        [{ id: 'editable', image: 'x' }, { id: 'base', role: 'frame-base', image: 'base' }],
        [{ id: 'base1', role: 'frame-base', image: 'base' }, { id: 'base2', role: 'frame-base', image: 'base2' }],
    ]) {
        const result = createFrameSet({ width: 1, height: 1, frames: [{ id: 'a', layers }] });
        assert.equal(result.ok, false);
        assert.equal(result.error.code, 'invalid-layer-stack');
    }
});

const makeCopyFrameSet = () => ({
    width: 4,
    height: 4,
    baseLayer: { visible: true, opacity: 0.35 },
    frames: [
        { id: 'source', layers: [
            { id: 'source-base', role: 'frame-base', image: { px: 'key-1' } },
            { id: 'source-l2', name: 'Sketch', isVisible: true, opacity: 0.75, mixModeStr: 'multiply', hasClipping: false, image: { px: 'sketch' } },
            { id: 'source-l3', name: 'Ink', isVisible: false, opacity: 0.6, mixModeStr: 'screen', hasClipping: true, image: { px: 'ink' } },
        ] },
        { id: 'key-2', layers: [
            { id: 'target-base', role: 'frame-base', image: { px: 'key-2' } },
            { id: 'old-2', name: 'Old', image: { px: 'old-2' } },
        ] },
        { id: 'plain', layers: [
            { id: 'old-3', name: 'Old', image: { px: 'old-3' } },
        ] },
    ],
});

test('replace copy preserves target base and replaces editable layers with independent metadata clones', () => {
    const input = makeCopyFrameSet();
    const baseImage = input.frames[1].layers[0].image;
    const sourceBefore = structuredClone(input.frames[0]);
    let next = 0;
    const clonedImages = [];
    const result = copyLayersToFrames(input, 0, ['source-l2', 'source-l3'], [1, 2], 'replace', (image) => {
        const copy = structuredClone(image);
        clonedImages.push(copy);
        return copy;
    }, () => `copy-${next++}`);

    assert.equal(result.ok, true);
    assert.deepEqual(result.value.appliedTargetIndexes, [1, 2]);
    assert.deepEqual(result.value.skippedTargetIndexes, []);
    const target = result.value.frameSet.frames[1];
    assert.equal(target.layers[0].id, 'target-base');
    assert.equal(target.layers[0].image, baseImage);
    assert.deepEqual(target.layers.slice(1).map((layer) => [layer.name, layer.isVisible, layer.opacity, layer.mixModeStr, layer.hasClipping]), [
        ['Sketch', true, 0.75, 'multiply', false],
        ['Ink', false, 0.6, 'screen', true],
    ]);
    assert.equal(target.layers[1].id, 'copy-0');
    assert.notEqual(target.layers[1].image, input.frames[0].layers[1].image);
    assert.notEqual(result.value.frameSet.frames[2].layers[0].image, input.frames[0].layers[1].image);
    assert.equal(clonedImages.length, 4);
    assert.deepEqual(input.frames[0], sourceBefore);
});

test('add-on-top preserves target editable layers and appends selected layers in source order', () => {
    const input = makeCopyFrameSet();
    let next = 0;
    const result = copyLayersToFrames(input, 0, ['source-l3', 'source-l2'], [1], 'add', (image) => structuredClone(image), () => `add-${next++}`);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.frameSet.frames[1].layers.map((layer) => layer.id), [
        'target-base', 'old-2', 'add-0', 'add-1',
    ]);
    assert.deepEqual(result.value.frameSet.frames[1].layers.slice(-2).map((layer) => layer.name), ['Sketch', 'Ink']);
});

test('copy skips only targets that exceed the layer cap', () => {
    const input = makeCopyFrameSet();
    let next = 0;
    const result = copyLayersToFrames(input, 0, ['source-l2', 'source-l3'], [1, 2], 'replace', (image) => structuredClone(image), () => `cap-${next++}`, 2);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.skippedTargetIndexes, [1]);
    assert.deepEqual(result.value.appliedTargetIndexes, [2]);
    assert.deepEqual(result.value.frameSet.frames[1].layers.map((layer) => layer.id), ['target-base', 'old-2']);
    assert.deepEqual(result.value.frameSet.frames[2].layers.map((layer) => layer.name), ['Sketch', 'Ink']);
});

test('enforces the shared per-frame layer limit', () => {
    const width = 4096;
    const height = 4096;
    const result = createFrameSet({
        width,
        height,
        frames: makeFrames(1, 17),
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'frame-layer-limit');
});

test('frame operations preserve order, unique ids, and active selection', () => {
    const initial = createFrameSet({
        width: 10,
        height: 10,
        frames: [
            { id: 'a', layers: [{ id: 'la', image: 'pixels-a' }] },
            { id: 'b', layers: [{ id: 'lb', image: 'pixels-b' }] },
        ],
    });
    assert.equal(initial.ok, true);
    let state = { frameSet: initial.value, activeFrameIndex: 0 };

    let operation = addFrame(state, { id: 'c', layers: [{ id: 'lc', image: 'pixels-c' }] });
    assert.equal(operation.ok, true);
    state = operation.value;
    assert.deepEqual(state.frameSet.frames.map((frame) => frame.id), ['a', 'c', 'b']);
    assert.equal(state.activeFrameIndex, 1);

    operation = duplicateFrame(state, 'c-copy', ['lc-copy']);
    assert.equal(operation.ok, true);
    state = operation.value;
    assert.deepEqual(state.frameSet.frames.map((frame) => frame.id), ['a', 'c', 'c-copy', 'b']);
    assert.equal(state.frameSet.frames[2].layers[0].id, 'lc-copy');
    assert.equal(state.activeFrameIndex, 2);

    operation = moveFrame(state, 2, 1);
    assert.equal(operation.ok, true);
    state = operation.value;
    assert.deepEqual(state.frameSet.frames.map((frame) => frame.id), ['a', 'c', 'b', 'c-copy']);
    assert.equal(state.activeFrameIndex, 3);

    operation = selectFrame(state, 0);
    assert.equal(operation.ok, true);
    state = operation.value;
    assert.equal(state.activeFrameIndex, 0);

    operation = deleteFrame(state, 0);
    assert.equal(operation.ok, true);
    state = operation.value;
    assert.deepEqual(state.frameSet.frames.map((frame) => frame.id), ['c', 'b', 'c-copy']);
    assert.equal(state.activeFrameIndex, 0);
    assert.equal(new Set(state.frameSet.frames.map((frame) => frame.id)).size, 3);
});

test('refuses deletion of the last frame without changing state', () => {
    const initial = createFrameSet({
        width: 10,
        height: 10,
        frames: [{ id: 'only', layers: [{ id: 'l', image: 'pixels' }] }],
    });
    assert.equal(initial.ok, true);
    const state = { frameSet: initial.value, activeFrameIndex: 0 };
    const operation = deleteFrame(state, 0);
    assert.equal(operation.ok, false);
    assert.equal(operation.error.code, 'last-frame');
    assert.deepEqual(state.frameSet.frames.map((frame) => frame.id), ['only']);
});

test('referenceTrack follows stable frame ids through frame operations', () => {
    const initial = createFrameSet({
        width: 10,
        height: 10,
        frames: [
            { id: 'a', layers: [{ id: 'la', image: 'pixels-a' }] },
            { id: 'b', layers: [{ id: 'lb', image: 'pixels-b' }] },
        ],
        referenceTrack: { a: 'original-a', b: 'original-b' },
    });
    assert.equal(initial.ok, true);
    let state = { frameSet: initial.value, activeFrameIndex: 0 };

    let operation = addFrame(state, { id: 'c', layers: [{ id: 'lc', image: 'pixels-c' }] });
    assert.equal(operation.ok, true);
    state = operation.value;
    assert.deepEqual(state.frameSet.referenceTrack, { a: 'original-a', b: 'original-b' });

    operation = selectFrame(state, 0);
    assert.equal(operation.ok, true);
    state = operation.value;
    operation = duplicateFrame(state, 'a-copy', ['la-copy']);
    assert.equal(operation.ok, true);
    state = operation.value;
    assert.equal(state.frameSet.referenceTrack['a-copy'], 'original-a');

    operation = moveFrame(state, 1, 1);
    assert.equal(operation.ok, true);
    state = operation.value;
    assert.deepEqual(state.frameSet.frames.map((frame) => frame.id), ['a', 'c', 'a-copy', 'b']);
    assert.equal(state.frameSet.referenceTrack.a, 'original-a');
    assert.equal(state.frameSet.referenceTrack['a-copy'], 'original-a');

    operation = deleteFrame(state, 0);
    assert.equal(operation.ok, true);
    state = operation.value;
    assert.equal(state.frameSet.referenceTrack.a, undefined);
    assert.equal(state.frameSet.referenceTrack['a-copy'], 'original-a');
    assert.equal(state.frameSet.referenceTrack.b, 'original-b');
});
