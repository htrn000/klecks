import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addFrame,
    createFrameSet,
    deleteFrame,
    duplicateFrame,
    FRAME_SET_MEMORY_BUDGET_BYTES,
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
