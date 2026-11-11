import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PROJECT_PALETTE_COLORS, addPaletteColor, removePaletteColor, movePaletteColor,
  normalizePalette, extractPaletteFromRgba, parseHexPalette, serializeHexPalette,
  parseGplPalette, serializeGplPalette,
} from './palette-model.ts';

test('palette operations preserve order, deduplicate, and enforce 64 colors', () => {
  let palette = normalizePalette({ colors: [{ r: 1, g: 2, b: 3 }, { r: 4, g: 5, b: 6 }] });
  palette = addPaletteColor(palette, { r: 1, g: 2, b: 3 });
  assert.equal(palette.colors.length, 2);
  palette = movePaletteColor(palette, 0, 1);
  assert.deepEqual(palette.colors[1], { r: 1, g: 2, b: 3 });
  palette = removePaletteColor(palette, 0);
  assert.deepEqual(palette.colors, [{ r: 1, g: 2, b: 3 }]);
  assert.equal(normalizePalette({ colors: Array.from({ length: 80 }, (_, i) => ({ r: i, g: 0, b: 0 })) }).colors.length, MAX_PROJECT_PALETTE_COLORS);
});

test('.hex and .gpl round-trip and skip malformed records', () => {
  const palette = { colors: [{ r: 12, g: 34, b: 56 }, { r: 255, g: 0, b: 1 }] };
  const hex = serializeHexPalette(palette);
  assert.deepEqual(parseHexPalette(`not-a-color\n${hex}#fff`), palette);
  const gpl = serializeGplPalette(palette, 'Test');
  assert.deepEqual(parseGplPalette(`${gpl}999 0 0 Bad\nnot a row`), palette);
  assert.equal(parseGplPalette('not a GIMP palette').colors.length, 0);
});

test('image extraction keeps pixel-art colors exactly at the 64-color threshold', () => {
  const pixels = new Uint8Array([10, 20, 30, 255, 1, 2, 3, 0, 10, 20, 30, 255, 200, 100, 50, 128]);
  assert.deepEqual(extractPaletteFromRgba(pixels, 2, 2).colors, [{ r: 10, g: 20, b: 30 }, { r: 200, g: 100, b: 50 }]);
  const pixels64 = new Uint8Array(64 * 4);
  for (let i = 0; i < 64; i++) pixels64.set([i * 4, 0, 0, 255], i * 4);
  assert.deepEqual(extractPaletteFromRgba(pixels64, 8, 8).colors, Array.from({ length: 64 }, (_, i) => ({ r: i * 4, g: 0, b: 0 })));
});

test('image extraction merges antialiased shades and ignores alpha below 128 above 64 colors', () => {
  const samples = [];
  for (let i = 0; i < 5; i++) samples.push([100, 100, 100, 255]);
  for (let i = 0; i < 3; i++) samples.push([105, 100, 100, 255]);
  for (let i = 0; i < 65; i++) samples.push([i, 255 - i, 0, 1]);
  const pixels = Uint8Array.from(samples.flat());
  assert.deepEqual(extractPaletteFromRgba(pixels, samples.length, 1).colors, [{ r: 100, g: 100, b: 100 }]);
});

test('image extraction caps to 64 most frequent distant colors deterministically', () => {
  const colors = [];
  const samples = [];
  for (let r = 0; r < 8 && colors.length < 70; r++) {
    for (let g = 0; g < 8 && colors.length < 70; g++) {
      for (let b = 0; b < 8 && colors.length < 70; b++) {
        const color = { r: r * 32, g: g * 32, b: b * 32 };
        colors.push(color);
        const frequency = colors.length <= 5 ? 2 : 1;
        for (let i = 0; i < frequency; i++) samples.push([color.r, color.g, color.b, 255]);
      }
    }
  }
  const pixels = Uint8Array.from(samples.flat());
  const palette = extractPaletteFromRgba(pixels, samples.length, 1);
  assert.equal(palette.colors.length, MAX_PROJECT_PALETTE_COLORS);
  assert.deepEqual(palette.colors, colors.slice(0, MAX_PROJECT_PALETTE_COLORS));
  assert.deepEqual(extractPaletteFromRgba(pixels, samples.length, 1), palette);
});
