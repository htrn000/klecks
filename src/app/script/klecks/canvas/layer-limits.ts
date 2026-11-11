/**
 * Memory-based layer limits shared by canvas editing and the pure FrameSet model.
 * This module intentionally has no browser or canvas dependencies.
 */
export const MAX_LAYERS = 64;
export const LAYER_MEMORY_BUDGET_BYTES = 1024 * 1024 * 1024;

export function maxLayersFor(width: number, height: number): number {
    const bytesPerLayer = width * height * 4;
    if (!Number.isFinite(bytesPerLayer) || bytesPerLayer <= 0) {
        return 0;
    }
    return Math.min(MAX_LAYERS, Math.floor(LAYER_MEMORY_BUDGET_BYTES / bytesPerLayer));
}

export function canAddLayer(width: number, height: number, layerCount: number): boolean {
    return layerCount < maxLayersFor(width, height);
}
