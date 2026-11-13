import test from 'node:test';
import assert from 'node:assert/strict';
import {
    projectFramesToStored,
    referenceTrackToStored,
    storedFramesToProject,
    storedReferenceTrackToProject,
} from './project-frame-converter.ts';

test('FrameSet project/storage conversion preserves geometry, order, active index, and layer metadata', async () => {
    const projectFrames = {
        width: 600,
        height: 510,
        activeFrameIndex: 2,
        baseLayer: { visible: true, opacity: 0.8 },
        otherLayerOpacity: 0.3,
        sheet: {
            cellWidth: 600,
            cellHeight: 510,
            frameCount: 3,
            trailingPaddingPx: 28,
            sheetWidth: 1828,
            sheetHeight: 510,
        },
        rnsPackage: {
            packageName: 'Synthetic Mod',
            files: { 'Animations.csv': new Uint8Array([1, 2, 3]) },
            animationKey: 'anim_test',
            highQualityPath: 'hero.png',
            lowQualityPath: 'hero_lq.png',
            lowQualityWidth: 300,
            lowQualityHeight: 250,
        },
        referenceTrack: {
            idle: 'original-idle',
            attack: 'original-attack',
        },
        frames: [
            {
                id: 'idle',
                thumbnail: 'data:image/png;base64,thumb-1',
                layers: [
                    {
                        id: 'idle-layer',
                        name: 'Ink',
                        role: 'frame-base',
                        isVisible: false,
                        opacity: 0.75,
                        mixModeStr: 'multiply',
                        hasClipping: true,
                        image: 'image-idle',
                    },
                ],
            },
            {
                id: 'run',
                layers: [
                    {
                        id: 'run-lines',
                        name: 'Lines',
                        isVisible: true,
                        opacity: 1,
                        mixModeStr: 'source-over',
                        hasClipping: false,
                        image: 'image-run',
                    },
                    {
                        id: 'run-color',
                        name: 'Color',
                        isVisible: true,
                        opacity: 0.6,
                        mixModeStr: 'overlay',
                        hasClipping: true,
                        image: 'image-run-color',
                    },
                ],
            },
            {
                id: 'attack',
                thumbnail: 'data:image/png;base64,thumb-3',
                layers: [
                    {
                        id: 'attack-layer',
                        name: 'Attack',
                        isVisible: true,
                        opacity: 0.9,
                        mixModeStr: 'screen',
                        hasClipping: false,
                        image: 'image-attack',
                    },
                ],
            },
        ],
    };
    const record = await projectFramesToStored(projectFrames, (image) => `blob:${image}`);
    assert.deepEqual(record.frames.map((frame) => frame.id), ['idle', 'run', 'attack']);
    assert.equal(record.frames[0].layers[0].blob, 'blob:image-idle');
    const restored = await storedFramesToProject(record, (blob) => blob.replace('blob:', ''));
    assert.deepEqual(
        restored,
        structuredClone(projectFrames),
    );
});

test('old single-frame project shape remains frame-free through conversion', async () => {
    const recordFrames = await projectFramesToStored(undefined, (image) => image);
    const restoredFrames = await storedFramesToProject(undefined, (image) => image);
    assert.equal(recordFrames, undefined);
    assert.equal(restoredFrames, undefined);
});

test('other-layer display opacity round-trips and defaults to 1 for older frame records', async () => {
    const frameSet = {
        width: 1,
        height: 1,
        activeFrameIndex: 0,
        frames: [{ id: 'f1', layers: [{ id: 'l1', image: 'png' }] }],
    };
    const olderStored = await projectFramesToStored(frameSet, (image) => image);
    assert.equal(olderStored.otherLayerOpacity, 1);
    const olderRestored = await storedFramesToProject(olderStored, (blob) => blob);
    assert.equal(olderRestored.otherLayerOpacity, 1);

    const newStored = await projectFramesToStored({ ...frameSet, otherLayerOpacity: 0.25 }, (image) => image);
    const newRestored = await storedFramesToProject(newStored, (blob) => blob);
    assert.equal(newRestored.otherLayerOpacity, 0.25);
});

test('project referenceTrack PNG handles round-trip through the reserved storage slot', async () => {
    const referenceTrack = { idle: 'original-idle', attack: 'original-attack' };
    const record = await referenceTrackToStored(referenceTrack, (image) => `png:${image}`);
    assert.deepEqual(record, {
        idle: 'png:original-idle',
        attack: 'png:original-attack',
    });
    const restored = await storedReferenceTrackToProject(record, (blob) => blob.replace('png:', ''));
    assert.deepEqual(restored, referenceTrack);
});
