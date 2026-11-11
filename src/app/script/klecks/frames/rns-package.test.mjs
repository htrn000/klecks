import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyRnsPackageEdits,
    listRnsAnimations,
    normalizeRnsFolderPath,
    parseCsvRows,
    readZipFile,
    rnsPackageNameFromPath,
    writeStoredZip,
} from './rns-package.ts';

const enc = (s) => new TextEncoder().encode(s);

test('folder inputs preserve or reconstruct Mods package roots', () => {
    assert.equal(normalizeRnsFolderPath('SampleMod/Animations.csv', 'Animations.csv'), 'Mods/SampleMod/Animations.csv');
    assert.equal(normalizeRnsFolderPath('Mods/SampleMod/Animations.csv', 'Animations.csv'), 'Mods/SampleMod/Animations.csv');
    assert.equal(rnsPackageNameFromPath('Mods/SampleMod/Animations.csv'), 'SampleMod');
});

test('CSV animation selection parses metadata without rewriting source bytes', () => {
    const csv = enc('key,filepath,filepathLowQuality\r\na,hero.png,hero_lq.png\r\n');
    const files = new Map([['Animations.csv', csv], ['SheetList.csv', enc('Sheet Type,filename\nAnimationSheetSimple,Animations\n')]]);
    assert.deepEqual(listRnsAnimations(files), [{ key: 'a', highQualityPath: 'hero.png', lowQualityPath: 'hero_lq.png' }]);
    assert.deepEqual(files.get('Animations.csv'), csv);
    assert.deepEqual(parseCsvRows(enc('a,"hello, world"\n')), [['a', 'hello, world']]);
});

test('package edits replace only selected HQ/LQ files and preserve all passthrough bytes', () => {
    const files = new Map([
        ['Animations.csv', enc('key,filepath\na,hero.png\n')],
        ['SheetList.csv', Uint8Array.from([9, 8, 7])],
        ['hero.png', Uint8Array.from([1, 2])],
        ['hero_lq.png', Uint8Array.from([3, 4])],
        ['thumb.png', Uint8Array.from([5, 6])],
    ]);
    const output = applyRnsPackageEdits(files, 'hero.png', enc('new-hq'), 'hero_lq.png', enc('new-lq'));
    assert.deepEqual(output.get('Animations.csv'), files.get('Animations.csv'));
    assert.deepEqual(output.get('SheetList.csv'), files.get('SheetList.csv'));
    assert.deepEqual(output.get('thumb.png'), files.get('thumb.png'));
    assert.deepEqual(output.get('hero.png'), enc('new-hq'));
    assert.deepEqual(output.get('hero_lq.png'), enc('new-lq'));
});

test('stored ZIP writer and reader round-trip a synthetic package fixture', async () => {
    const fixture = new Map([
        ['Mods/demo/Animations.csv', enc('key,filepath\na,hero.png\n')],
        ['Mods/demo/SheetList.csv', enc('Sheet Type,filename\nAnimationSheetSimple,Animations\n')],
        ['Mods/demo/hero.png', Uint8Array.from([0, 1, 255, 32])],
    ]);
    assert.deepEqual(await readZipFile(new Blob([writeStoredZip(fixture)])), fixture);
});
