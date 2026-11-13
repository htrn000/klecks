import test from 'node:test';
import assert from 'node:assert/strict';
import { assignBaseLayer, detachBaseLayer } from './frame-base-layer.ts';

const base = { id: 'base', name: 'Original', role: 'frame-base', image: 'base-pixels', isVisible: false, opacity: 0.35 };
const layer = (id, extra = {}) => ({ id, name: id, image: `pixels-${id}`, isVisible: true, opacity: 1, mixModeStr: 'multiply', ...extra });

test('assign promotes selected layer to index 0 and detaches an existing base', () => {
    const frame = { id: 'f1', layers: [base, layer('ink')] };
    const assigned = assignBaseLayer(frame, 'ink', () => layer('new'));
    assert.equal(assigned.layers[0].id, 'ink');
    assert.equal(assigned.layers[0].role, 'frame-base');
    assert.equal(assigned.layers[1].id, 'base');
    assert.equal('role' in assigned.layers[1], false);
    assert.equal(assigned.layers[1].opacity, 1);
    assert.equal(assigned.layers[1].isVisible, true);
    assert.equal(assigned.layers[1].mixModeStr, 'source-over');
});

test('detach leaves the base at index 0 as a normal fully visible layer', () => {
    const detached = detachBaseLayer({ id: 'f1', layers: [base, layer('ink')] });
    assert.equal(detached.layers[0].id, 'base');
    assert.equal('role' in detached.layers[0], false);
    assert.equal(detached.layers[0].image, 'base-pixels');
    assert.equal(detached.layers[0].isVisible, true);
    assert.equal(detached.layers[0].opacity, 1);
    assert.equal(detached.layers[0].mixModeStr, 'source-over');
});

test('assigning the only layer creates an editable layer when allowed', () => {
    const assigned = assignBaseLayer({ id: 'f1', layers: [layer('only')] }, 'only', () => layer('new'));
    assert.deepEqual(assigned.layers.map((item) => [item.id, item.role]), [
        ['only', 'frame-base'],
        ['new', undefined],
    ]);
});

test('assigning at the layer cap can omit the extra editable layer', () => {
    const assigned = assignBaseLayer({ id: 'f1', layers: [layer('only')] }, 'only', () => undefined);
    assert.equal(assigned.layers.length, 1);
    assert.equal(assigned.layers[0].role, 'frame-base');
});
