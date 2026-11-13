import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MAX_CACHED_FRAME_HISTORIES,
    dropCachedFrameHistories,
    getCachedFrameHistory,
    setCachedFrameHistory,
} from './frame-history-cache.ts';

test('frame history cache evicts the least recently used stack after eight frames', () => {
    const cache = new Map();
    const lru = [];
    for (let index = 0; index < 8; index++) {
        setCachedFrameHistory(cache, lru, `frame-${index}`, { marker: index });
    }
    assert.equal(getCachedFrameHistory(cache, lru, 'frame-0').marker, 0);
    const evicted = setCachedFrameHistory(cache, lru, 'frame-8', { marker: 8 });
    assert.equal(MAX_CACHED_FRAME_HISTORIES, 8);
    assert.deepEqual(evicted, ['frame-1']);
    assert.equal(cache.has('frame-1'), false);
    assert.equal(cache.has('frame-0'), true);
});

test('frame history invalidation drops deleted and externally replaced frame stacks', () => {
    const cache = new Map();
    const lru = [];
    for (const id of ['deleted', 'copied-target', 'kept']) {
        setCachedFrameHistory(cache, lru, id, { id });
    }
    dropCachedFrameHistories(cache, lru, ['deleted', 'copied-target']);
    assert.deepEqual([...cache.keys()], ['kept']);
    assert.deepEqual(lru, ['kept']);
});
