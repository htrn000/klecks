import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// kl-history.ts uses extensionless imports and pulls in DOM-dependent helpers.
register('../../../../test/resolve-ts-loader.mjs', import.meta.url);
const { KlHistory } = await import('./kl-history.ts');

function baseState() {
    return {
        projectId: { value: 'project' },
        size: { width: 1, height: 1 },
        selection: { value: [] },
        activeLayerId: 'layer',
        layerMap: {
            layer: {
                name: 'Layer 1',
                opacity: 1,
                isVisible: true,
                mixModeStr: 'source-over',
                hasClipping: false,
                index: 0,
                tiles: [{ fill: 'transparent' }],
            },
        },
    };
}

test('KlHistory export/import preserves undo and redo branches while changeCount stays monotonic', () => {
    const history = new KlHistory({ oldest: baseState() });
    history.push({ layerMap: { layer: { name: 'Stroke 1' } } });
    history.push({ layerMap: { layer: { opacity: 0.5 } } });
    history.push({ layerMap: { layer: { name: 'Stroke 2' } } });
    history.decreaseIndex();

    const state = history.exportState();
    const entries = state.entries;
    const composed = state.composed;
    const beforeImport = history.getChangeCount();
    history.importState(state);

    assert.equal(history.getChangeCount(), beforeImport + 1);
    assert.equal(history.exportState().entries, entries);
    assert.equal(history.getComposed(), composed);
    assert.equal(history.canUndo(), true);
    assert.equal(history.canRedo(), true);

    history.increaseIndex();
    assert.equal(history.getComposed().layerMap.layer.name, 'Stroke 2');
    history.decreaseIndex();
    assert.equal(history.getComposed().layerMap.layer.name, 'Stroke 1');
    const beforeNextPush = history.getChangeCount();
    history.push({ layerMap: { layer: { opacity: 0.75 } } });
    assert.ok(history.getChangeCount() > beforeNextPush);
    assert.equal(history.canRedo(), false);
});
