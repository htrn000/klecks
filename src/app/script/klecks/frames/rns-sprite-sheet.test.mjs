import assert from 'node:assert/strict';
import test from 'node:test';
import {
    detectRnsSpriteGeometry,
    scaleRgbaNearest,
    sliceRgbaSpriteSheet,
    stitchRgbaSpriteSheet,
} from './rns-sprite-sheet.ts';

function profile(width, occupiedRanges) {
    const result = new Uint8Array(width);
    for (const [start, end] of occupiedRanges) result.fill(1, start, end);
    return result;
}

test('detects P5 sample 1: 24 x 600 x 500', () => {
    const ranges = Array.from({ length: 24 }, (_, i) => [i * 600 + 20, i === 23 ? i * 600 + 300 : i * 600 + 100]);
    const found = detectRnsSpriteGeometry(14400, 500, profile(14400, ranges));
    assert.deepEqual(found[0].geometry, {
        cellWidth: 600, cellHeight: 500, frameCount: 24,
        trailingPaddingPx: 0, sheetWidth: 14400, sheetHeight: 500,
    });
});

test('detects P5 sample 2: 28 x 600 x 510 plus 28px tail', () => {
    const found = detectRnsSpriteGeometry(16828, 510, profile(16828, [[10, 100], [16790, 16800]]));
    assert.equal(found[0].geometry.cellWidth, 600);
    assert.equal(found[0].geometry.frameCount, 28);
    assert.equal(found[0].geometry.trailingPaddingPx, 28);
});

test('detects P5 sample 3: 24 x 500 x 500', () => {
    const found = detectRnsSpriteGeometry(12000, 500, profile(12000, [[10, 30], [11980, 12000]]));
    assert.equal(found[0].geometry.cellWidth, 500);
    assert.equal(found[0].geometry.frameCount, 24);
    assert.equal(found[0].geometry.trailingPaddingPx, 0);
});

test('slice then stitch is byte-identical including trailing bytes', () => {
    const geometry = { cellWidth: 2, cellHeight: 2, frameCount: 2, trailingPaddingPx: 1, sheetWidth: 5, sheetHeight: 2 };
    const input = Uint8Array.from({ length: 40 }, (_, i) => (i * 37) % 256);
    const split = sliceRgbaSpriteSheet(input, geometry);
    assert.deepEqual(stitchRgbaSpriteSheet(split.frames, geometry, split.trailingPixels), input);
});

test('LQ nearest-neighbor scaling keeps exact supplied dimensions', () => {
    const source = Uint8Array.from([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,0,255]);
    assert.deepEqual(scaleRgbaNearest(source, 2, 2, 1, 1), Uint8Array.from([255,0,0,255]));
    assert.equal(scaleRgbaNearest(source, 2, 2, 3, 1).length, 12);
});
