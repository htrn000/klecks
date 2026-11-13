import type { TKlHistoryState } from '../history/kl-history.ts';

export const MAX_CACHED_FRAME_HISTORIES = 8;

export function getCachedFrameHistory(
    cache: Map<string, TKlHistoryState>,
    lru: string[],
    frameId: string,
): TKlHistoryState | undefined {
    const state = cache.get(frameId);
    if (state) {
        const index = lru.indexOf(frameId);
        if (index !== -1) lru.splice(index, 1);
        lru.push(frameId);
    }
    return state;
}

export function setCachedFrameHistory(
    cache: Map<string, TKlHistoryState>,
    lru: string[],
    frameId: string,
    state: TKlHistoryState,
    maxEntries = MAX_CACHED_FRAME_HISTORIES,
): string[] {
    cache.set(frameId, state);
    const previousIndex = lru.indexOf(frameId);
    if (previousIndex !== -1) lru.splice(previousIndex, 1);
    lru.push(frameId);
    const evicted: string[] = [];
    while (lru.length > maxEntries) {
        const oldest = lru.shift();
        if (oldest !== undefined) {
            cache.delete(oldest);
            evicted.push(oldest);
        }
    }
    return evicted;
}

export function dropCachedFrameHistories(
    cache: Map<string, TKlHistoryState>,
    lru: string[],
    frameIds: Iterable<string>,
): void {
    const removed = new Set(frameIds);
    for (const id of removed) cache.delete(id);
    for (let index = lru.length - 1; index >= 0; index--) {
        if (removed.has(lru[index])) lru.splice(index, 1);
    }
}

export function clearCachedFrameHistories(cache: Map<string, TKlHistoryState>, lru: string[]): void {
    cache.clear();
    lru.length = 0;
}
