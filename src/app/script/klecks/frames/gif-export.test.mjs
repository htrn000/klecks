import assert from 'node:assert/strict';
import test from 'node:test';
import {
    fpsToCentisecondDelays,
    encodeGifFrames,
    prepareGifPixels,
    scaleRgbaNearest,
    selectGifFrameRange,
} from './gif-export.ts';

test('real gifenc encoder path produces a GIF byte stream', () => {
    const bytes = encodeGifFrames([{
        width: 1,
        height: 1,
        pixels: Uint8Array.from([230, 40, 20, 255]),
    }], { fps: 12, loop: 'once', transparency: true, scale: 1 });
    assert.equal(new TextDecoder().decode(bytes.subarray(0, 6)), 'GIF89a');
    assert.equal(bytes.at(-1), 0x3b);
});

test('12 fps distributes GIF centisecond rounding as an 8/9 pattern', () => {
    assert.deepEqual(fpsToCentisecondDelays(12, 6), [8, 9, 8, 8, 9, 8]);
});

test('frame range is 1-based and inclusive', () => {
    assert.deepEqual(selectGifFrameRange(['a', 'b', 'c', 'd'], 2, 3), ['b', 'c']);
    assert.throws(() => selectGifFrameRange(['a'], 0, 1), RangeError);
});

test('transparency is thresholded to 1-bit or composited over the chosen background', () => {
    const pixels = Uint8Array.from([90, 30, 10, 127, 100, 50, 0, 128]);
    assert.deepEqual(prepareGifPixels(pixels, true), Uint8Array.from([0, 0, 0, 0, 100, 50, 0, 255]));
    assert.deepEqual(
        prepareGifPixels(pixels, false, { r: 255, g: 255, b: 255 }),
        Uint8Array.from([173, 143, 133, 255, 177, 152, 127, 255]),
    );
});

test('nearest-neighbor scale duplicates source pixels without interpolation', () => {
    const source = Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 0]);
    const scaled = scaleRgbaNearest(source, 2, 1, 2);
    assert.equal(scaled.width, 4);
    assert.equal(scaled.height, 2);
    assert.deepEqual(scaled.pixels, Uint8Array.from([
        1, 2, 3, 255, 1, 2, 3, 255, 4, 5, 6, 0, 4, 5, 6, 0,
        1, 2, 3, 255, 1, 2, 3, 255, 4, 5, 6, 0, 4, 5, 6, 0,
    ]));
});
