import assert from 'node:assert/strict';
import test from 'node:test';
import {
    detectRnsSpriteGeometry,
    assembleRnsSpriteSheet,
    encodeRgbaPng,
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
    assert.deepEqual(split.frames[0], Uint8Array.from([...input.slice(0, 8), ...input.slice(20, 28)]));
    assert.deepEqual(split.frames[1], Uint8Array.from([...input.slice(8, 16), ...input.slice(28, 36)]));
    assert.deepEqual(split.trailingPixels, Uint8Array.from([...input.slice(16, 20), ...input.slice(36, 40)]));
    assert.deepEqual(stitchRgbaSpriteSheet(split.frames, geometry, split.trailingPixels), input);
});

test('sprite export substitutes edited pixels in the active frame only', () => {
    const geometry = { cellWidth: 2, cellHeight: 1, frameCount: 3, trailingPaddingPx: 1, sheetWidth: 7, sheetHeight: 1 };
    const original = [
        Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 255]),
        Uint8Array.from([11, 12, 13, 255, 14, 15, 16, 255]),
        Uint8Array.from([21, 22, 23, 255, 24, 25, 26, 255]),
    ];
    const editedActive = Uint8Array.from([31, 32, 33, 255, 34, 35, 36, 255]);
    const tail = Uint8Array.from([0, 0, 0, 0]);
    const output = assembleRnsSpriteSheet(original, geometry, tail, 1, editedActive);
    const split = sliceRgbaSpriteSheet(output, geometry);
    assert.deepEqual(split.frames, [original[0], editedActive, original[2]]);
    assert.deepEqual(split.trailingPixels, tail);
});

test('PNG encoder preserves assembled RGBA bytes without a canvas round-trip', async () => {
    const rgba = Uint8Array.from([0, 0, 0, 0, 255, 4, 8, 1, 3, 200, 90, 128, 255, 255, 255, 255]);
    const png = new Uint8Array(await (await encodeRgbaPng(rgba, 2, 2)).arrayBuffer());
    assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    let offset = 8;
    let idat = new Uint8Array();
    while (offset < png.length) {
        const length = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0);
        const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
        if (type === 'IDAT') idat = png.slice(offset + 8, offset + 8 + length);
        offset += length + 12;
    }
    const scanlines = new Uint8Array(await new Response(
        new Blob([idat.buffer]).stream().pipeThrough(new DecompressionStream('deflate')),
    ).arrayBuffer());
    assert.deepEqual(scanlines, Uint8Array.from([0, ...rgba.slice(0, 8), 0, ...rgba.slice(8)]));
});

test('LQ nearest-neighbor scaling keeps exact supplied dimensions', () => {
    const source = Uint8Array.from([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,0,255]);
    assert.deepEqual(scaleRgbaNearest(source, 2, 2, 1, 1), Uint8Array.from([255,0,0,255]));
    assert.equal(scaleRgbaNearest(source, 2, 2, 3, 1).length, 12);
});
