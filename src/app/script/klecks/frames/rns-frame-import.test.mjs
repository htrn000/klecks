import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRnsImportedFrameSet } from './rns-frame-import.ts';

test('R&S imported cells keep hidden originals, blank editable layers, and references', () => {
    let nextId = 0;
    const cells = [
        Uint8Array.from([1, 2, 3, 255]),
        Uint8Array.from([4, 5, 6, 255]),
    ];
    const result = buildRnsImportedFrameSet(cells, {
        cellWidth: 1,
        cellHeight: 1,
        frameCount: 2,
        trailingPaddingPx: 0,
        sheetWidth: 2,
        sheetHeight: 1,
    }, {
        originalLayerName: 'Original',
        editableLayerName: 'Layer 2',
        makeId: () => `id-${nextId++}`,
        createImage: (pixels) => pixels,
        createBlankImage: () => 'transparent',
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.activeFrameIndex, 0);
    assert.equal(result.value.activeLayerIndex, 1);
    assert.equal(result.value.usedSingleLayerFallback, false);
    assert.deepEqual(result.value.frameSet.frames.map((frame) => frame.layers.map((layer) => ({
        name: layer.name,
        isVisible: layer.isVisible,
        opacity: layer.opacity,
        image: layer.image instanceof Uint8Array ? [...layer.image] : layer.image,
    }))), [
        [
            { name: 'Original', isVisible: false, opacity: 1, image: [1, 2, 3, 255] },
            { name: 'Layer 2', isVisible: true, opacity: 1, image: 'transparent' },
        ],
        [
            { name: 'Original', isVisible: false, opacity: 1, image: [4, 5, 6, 255] },
            { name: 'Layer 2', isVisible: true, opacity: 1, image: 'transparent' },
        ],
    ]);
    const firstId = result.value.frameSet.frames[0].id;
    const secondId = result.value.frameSet.frames[1].id;
    assert.deepEqual([...result.value.frameSet.referenceTrack[firstId]], [1, 2, 3, 255]);
    assert.deepEqual([...result.value.frameSet.referenceTrack[secondId]], [4, 5, 6, 255]);
    assert.equal(result.value.frameSet.referenceTrack[firstId], result.value.frameSet.frames[0].layers[0].image);
});

test('falls back to a visible original layer when a second layer exceeds the memory limit', () => {
    const result = buildRnsImportedFrameSet([new Uint8Array(4)], {
        cellWidth: 12000,
        cellHeight: 12000,
        frameCount: 1,
        trailingPaddingPx: 0,
        sheetWidth: 12000,
        sheetHeight: 12000,
    }, {
        originalLayerName: 'Original',
        editableLayerName: 'Layer 2',
        createImage: (pixels) => pixels,
        createBlankImage: () => 'transparent',
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.usedSingleLayerFallback, true);
    assert.equal(result.value.activeLayerIndex, 0);
    assert.deepEqual(result.value.frameSet.frames[0].layers.map(({ name, isVisible }) => ({ name, isVisible })), [
        { name: 'Original', isVisible: true },
    ]);
    assert.ok(result.value.frameSet.referenceTrack[result.value.frameSet.frames[0].id]);
});
