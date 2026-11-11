import { LAYER_MEMORY_BUDGET_BYTES, maxLayersFor } from '../canvas/layer-limits.ts';

/**
 * Aggregate raw RGBA layer budget: twice the per-frame budget allows one maximum-size
 * frame plus one equally large frame in the same editable set, while bounding growth.
 */
export const FRAME_SET_MEMORY_BUDGET_BYTES = 2 * LAYER_MEMORY_BUDGET_BYTES;

export type TFrameLayer = {
    id: string;
    /** Opaque storage handle; the model does not depend on browser image types. */
    image: unknown;
};

export type TFrame = {
    id: string;
    layers: TFrameLayer[];
};

/** Geometry for a one-row horizontal sprite sheet. Padding is retained after the last full cell. */
export type TFrameSheetGeometry = {
    cellWidth: number;
    cellHeight: number;
    frameCount: number;
    trailingPaddingPx: number;
    sheetWidth: number;
    sheetHeight: number;
};

export type TFrameSet = {
    width: number;
    height: number;
    frames: TFrame[];
    sheet?: TFrameSheetGeometry;
};

export type TFrameSetErrorCode =
    | 'invalid-frame-set'
    | 'invalid-size'
    | 'no-frames'
    | 'invalid-frame'
    | 'duplicate-frame-id'
    | 'invalid-layer-stack'
    | 'frame-layer-limit'
    | 'invalid-sheet-geometry'
    | 'frame-count-mismatch'
    | 'frame-set-memory-limit';

export type TFrameSetError = {
    code: TFrameSetErrorCode;
    message: string;
    frameIndex?: number;
};

export type TFrameSetValidationResult =
    | { ok: true; value: TFrameSet; memoryBytes: bigint }
    | { ok: false; error: TFrameSetError };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function error(
    code: TFrameSetErrorCode,
    message: string,
    frameIndex?: number,
): TFrameSetValidationResult {
    return { ok: false, error: { code, message, frameIndex } };
}

/** Exact uncompressed RGBA byte estimate for all layer canvases in a frame. */
export function frameMemoryBytes(width: number, height: number, layerCount: number): bigint {
    if (
        !isPositiveSafeInteger(width) ||
        !isPositiveSafeInteger(height) ||
        !Number.isSafeInteger(layerCount) ||
        layerCount < 0
    ) {
        return 0n;
    }
    return BigInt(width) * BigInt(height) * 4n * BigInt(layerCount);
}

/** Exact uncompressed RGBA byte estimate across all frame layer stacks. */
export function frameSetMemoryBytes(frameSet: TFrameSet): bigint {
    return frameSet.frames.reduce(
        (sum, frame) => sum + frameMemoryBytes(frameSet.width, frameSet.height, frame.layers.length),
        0n,
    );
}

/**
 * Validate untrusted FrameSet input without throwing for ordinary malformed user data.
 * The aggregate estimate uses raw RGBA bytes, not compressed PNG sizes.
 */
export function validateFrameSet(input: unknown): TFrameSetValidationResult {
    if (!isRecord(input)) {
        return error('invalid-frame-set', 'FrameSet must be an object');
    }
    const { width, height, frames, sheet } = input;
    if (!isPositiveSafeInteger(width) || !isPositiveSafeInteger(height)) {
        return error('invalid-size', 'Frame width and height must be positive safe integers');
    }
    if (!Array.isArray(frames) || frames.length < 1) {
        return error('no-frames', 'FrameSet must contain at least one frame');
    }

    const frameIds = new Set<string>();
    const validatedFrames: TFrame[] = [];
    let memoryBytes = 0n;
    const allowedLayers = maxLayersFor(width, height);
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
        const frame = frames[frameIndex];
        if (!isRecord(frame) || typeof frame.id !== 'string' || !frame.id.trim()) {
            return error('invalid-frame', 'Frame must have a non-empty string id', frameIndex);
        }
        if (frameIds.has(frame.id)) {
            return error('duplicate-frame-id', 'Frame ids must be unique', frameIndex);
        }
        frameIds.add(frame.id);
        if (!Array.isArray(frame.layers) || frame.layers.length < 1) {
            return error('invalid-layer-stack', 'Each frame must contain at least one layer', frameIndex);
        }
        if (frame.layers.length > allowedLayers) {
            return error('frame-layer-limit', 'Frame layer count exceeds the per-frame memory limit', frameIndex);
        }
        const layers: TFrameLayer[] = [];
        for (const layer of frame.layers) {
            if (!isRecord(layer) || typeof layer.id !== 'string' || !layer.id.trim() || !('image' in layer)) {
                return error('invalid-layer-stack', 'Each layer needs a non-empty id and image handle', frameIndex);
            }
            layers.push({ id: layer.id, image: layer.image });
        }
        memoryBytes += frameMemoryBytes(width, height, layers.length);
        if (memoryBytes > BigInt(FRAME_SET_MEMORY_BUDGET_BYTES)) {
            return error('frame-set-memory-limit', 'FrameSet exceeds its total decoded-memory budget', frameIndex);
        }
        validatedFrames.push({ id: frame.id, layers });
    }

    let validatedSheet: TFrameSheetGeometry | undefined;
    if (sheet !== undefined) {
        if (!isRecord(sheet)) {
            return error('invalid-sheet-geometry', 'Sheet geometry must be an object');
        }
        const { cellWidth, cellHeight, frameCount, trailingPaddingPx, sheetWidth, sheetHeight } = sheet;
        if (
            !isPositiveSafeInteger(cellWidth) ||
            !isPositiveSafeInteger(cellHeight) ||
            !isPositiveSafeInteger(frameCount) ||
            !Number.isSafeInteger(trailingPaddingPx) ||
            (trailingPaddingPx as number) < 0 ||
            !isPositiveSafeInteger(sheetWidth) ||
            !isPositiveSafeInteger(sheetHeight) ||
            cellWidth !== width ||
            cellHeight !== height ||
            sheetHeight !== cellHeight ||
            BigInt(sheetWidth) !== BigInt(frameCount) * BigInt(cellWidth) + BigInt(trailingPaddingPx as number)
        ) {
            return error('invalid-sheet-geometry', 'Sheet dimensions must match frame cells and trailing padding');
        }
        if (frameCount !== frames.length) {
            return error('frame-count-mismatch', 'Sheet frame count must match FrameSet frame order');
        }
        validatedSheet = {
            cellWidth,
            cellHeight,
            frameCount,
            trailingPaddingPx: trailingPaddingPx as number,
            sheetWidth,
            sheetHeight,
        };
    }

    return {
        ok: true,
        value: {
            width,
            height,
            frames: validatedFrames,
            ...(validatedSheet ? { sheet: validatedSheet } : {}),
        },
        memoryBytes,
    };
}

/** Build a detached FrameSet value, returning a typed validation error on invalid input. */
export function createFrameSet(input: unknown): TFrameSetValidationResult {
    return validateFrameSet(input);
}

/** Exposes the per-layer cap used by the canvas for callers that need preflight estimates. */
export { LAYER_MEMORY_BUDGET_BYTES };
