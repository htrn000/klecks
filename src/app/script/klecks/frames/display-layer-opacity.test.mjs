import test from 'node:test';
import assert from 'node:assert/strict';
import { getDisplayLayerOpacity } from './display-layer-opacity.ts';

test('display opacity applies only to inactive editable layers and frame bases', () => {
    assert.equal(getDisplayLayerOpacity(0.7, true, false, 0.3, 0.4), 0.7);
    assert.equal(getDisplayLayerOpacity(0.7, false, true, 0.3, 0.4), 0.4);
    assert.equal(getDisplayLayerOpacity(0.8, false, false, 0.3, 0.4), 0.24);
    assert.equal(getDisplayLayerOpacity(0.8, false, false), 0.8);
});
