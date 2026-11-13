import { maxLayersFor } from '../canvas/layer-limits.ts';
import { createFrameSet, type TFrameSet, type TFrameSetError, type TFrameSheetGeometry } from './frame-set.ts';

export type TRnsImportedFrameSet = {
    frameSet: TFrameSet;
    /** First imported frame is active after import. */
    activeFrameIndex: 0;
    /** Editable top layer index; 0 when memory requires the single-layer fallback. */
    activeLayerIndex: 0 | 1;
    usedSingleLayerFallback: boolean;
};

export type TRnsFrameImportResult =
    | { ok: true; value: TRnsImportedFrameSet }
    | { ok: false; error: TFrameSetError };

export type TRnsFrameImportOptions = {
    originalLayerName: string;
    editableLayerName: string;
    makeId?: () => string;
    /** Creates an opaque image handle from one cell's RGBA pixels. */
    createImage?: (pixels: Uint8Array) => unknown;
    /** Creates a blank transparent image handle for the editable layer. */
    createBlankImage?: () => unknown;
};

/**
 * Creates per-cell frame data. Editable imports keep the original in a frame-base
 * layer and start a transparent editable layer above it.
 */
export function buildRnsImportedFrameSet(
    framePixels: readonly Uint8Array[],
    geometry: TFrameSheetGeometry,
    options: TRnsFrameImportOptions,
): TRnsFrameImportResult {
    let nextId = 0;
    const makeId = options.makeId ?? (() => `rns-import-${nextId++}`);

    const makeCandidate = (includeEditableLayer: boolean) => {
        const frames = framePixels.map((pixels) => {
            const id = makeId();
            const originalImage = options.createImage ? options.createImage(pixels.slice()) : pixels.slice();
            const layers = [{
                id: makeId(),
                name: options.originalLayerName,
                isVisible: true,
                opacity: includeEditableLayer ? 0.35 : 1,
                mixModeStr: 'source-over',
                hasClipping: false,
                image: originalImage,
                ...(includeEditableLayer ? { role: 'frame-base' as const } : {}),
            }];
            if (includeEditableLayer) {
                layers.push({
                    id: makeId(),
                    name: options.editableLayerName,
                    isVisible: true,
                    opacity: 1,
                    mixModeStr: 'source-over',
                    hasClipping: false,
                    image: options.createBlankImage?.(),
                });
            }
            return { id, layers };
        });
        return createFrameSet({
            width: geometry.cellWidth,
            height: geometry.cellHeight,
            frames,
            sheet: geometry,
            ...(includeEditableLayer ? { baseLayer: { visible: true, opacity: 0.35 } } : {}),
        });
    };

    const canUseEditableLayer = maxLayersFor(geometry.cellWidth, geometry.cellHeight) >= 2;
    if (canUseEditableLayer) {
        const twoLayerResult = makeCandidate(true);
        if (twoLayerResult.ok) {
            return {
                ok: true,
                value: {
                    frameSet: twoLayerResult.value,
                    activeFrameIndex: 0,
                    activeLayerIndex: 1,
                    usedSingleLayerFallback: false,
                },
            };
        }
        if (twoLayerResult.error.code !== 'frame-set-memory-limit' && twoLayerResult.error.code !== 'frame-layer-limit') {
            return twoLayerResult;
        }
    }

    const oneLayerResult = makeCandidate(false);
    if (!oneLayerResult.ok) return oneLayerResult;
    return {
        ok: true,
        value: {
            frameSet: oneLayerResult.value,
            activeFrameIndex: 0,
            activeLayerIndex: 0,
            usedSingleLayerFallback: true,
        },
    };
}
