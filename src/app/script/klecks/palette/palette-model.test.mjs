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

test('image extraction keeps exact opaque colors and deterministically caps quantization at 64', () => {
  const pixels = new Uint8Array([10, 20, 30, 255, 1, 2, 3, 0, 10, 20, 30, 255, 200, 100, 50, 128]);
  assert.deepEqual(extractPaletteFromRgba(pixels, 2, 2).colors, [{ r: 10, g: 20, b: 30 }, { r: 200, g: 100, b: 50 }]);
  const many = new Uint8Array(100 * 4);
  for (let i = 0; i < 100; i++) many.set([i, (i * 71) % 256, (i * 137) % 256, 255], i * 4);
  const first = extractPaletteFromRgba(many, 10, 10);
  assert.equal(first.colors.length, 64);
  assert.deepEqual(extractPaletteFromRgba(many, 10, 10), first);
});
