import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFramesToStored, storedFramesToProject } from './project-frame-converter.ts';

test('FrameSet project/storage conversion preserves geometry, order, active index, and layer metadata', async () => {
    const projectFrames = {
        width: 600,
        height: 510,
        activeFrameIndex: 2,
        sheet: {
            cellWidth: 600,
            cellHeight: 510,
            frameCount: 3,
            trailingPaddingPx: 28,
            sheetWidth: 1828,
            sheetHeight: 510,
        },
        frames: [
            {
                id: 'idle',
                thumbnail: 'data:image/png;base64,thumb-1',
                layers: [
                    {
                        id: 'idle-layer',
                        name: 'Ink',
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
