import { LAYER_MEMORY_BUDGET_BYTES, maxLayersFor } from '../canvas/layer-limits.ts';

/**
 * Aggregate raw RGBA layer budget: twice the per-frame budget allows one maximum-size
 * frame plus one equally large frame in the same editable set, while bounding growth.
 */
export const FRAME_SET_MEMORY_BUDGET_BYTES = 2 * LAYER_MEMORY_BUDGET_BYTES;

export type TFrameLayer = {
    id: string;
    name?: string;
    isVisible?: boolean;
    opacity?: number;
    mixModeStr?: string;
    hasClipping?: boolean;
    /** Opaque storage handle; the model does not depend on browser image types. */
    image: unknown;
};

export type TFrame = {
    id: string;
    layers: TFrameLayer[];
    /** Optional thumbnail data URL for frame-strip presentation. */
    thumbnail?: string;
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
    /** Optional read-only original image handles keyed by stable frame id. */
    referenceTrack?: Record<string, unknown>;
};

/** Project-level FrameSet payload with the frame selected when the project was last stored. */
export type TFrameSetPayload = TFrameSet & {
    activeFrameIndex: number;
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
    | 'frame-set-memory-limit'
    | 'invalid-active-index'
    | 'last-frame';

export type TFrameSetError = {
    code: TFrameSetErrorCode;
    message: string;
    frameIndex?: number;
};

export type TFrameSetValidationResult =
    | { ok: true; value: TFrameSet; memoryBytes: bigint }
    | { ok: false; error: TFrameSetError };

export type TActiveFrameSet = {
    frameSet: TFrameSet;
    activeFrameIndex: number;
};

export type TFrameSetOperationResult =
    | { ok: true; value: TActiveFrameSet }
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
    const { width, height, frames, sheet, referenceTrack } = input;
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
            layers.push({
                id: layer.id,
                image: layer.image,
                ...(typeof layer.name === 'string' ? { name: layer.name } : {}),
                ...(typeof layer.isVisible === 'boolean' ? { isVisible: layer.isVisible } : {}),
                ...(typeof layer.opacity === 'number' ? { opacity: layer.opacity } : {}),
                ...(typeof layer.mixModeStr === 'string' ? { mixModeStr: layer.mixModeStr } : {}),
                ...(typeof layer.hasClipping === 'boolean' ? { hasClipping: layer.hasClipping } : {}),
            });
        }
        memoryBytes += frameMemoryBytes(width, height, layers.length);
        if (memoryBytes > BigInt(FRAME_SET_MEMORY_BUDGET_BYTES)) {
            return error('frame-set-memory-limit', 'FrameSet exceeds its total decoded-memory budget', frameIndex);
        }
        validatedFrames.push({
            id: frame.id,
            layers,
            ...(typeof frame.thumbnail === 'string' ? { thumbnail: frame.thumbnail } : {}),
        });
    }

    let validatedReferenceTrack: Record<string, unknown> | undefined;
    if (referenceTrack !== undefined) {
        if (!isRecord(referenceTrack)) {
            return error('invalid-frame-set', 'Reference track must be an object keyed by frame id');
        }
        validatedReferenceTrack = {};
        for (const [frameId, image] of Object.entries(referenceTrack)) {
            if (!frameIds.has(frameId) || image === undefined || image === null) {
                return error('invalid-frame', 'Reference image must belong to an existing frame', frames.findIndex((frame) => isRecord(frame) && frame.id === frameId));
            }
            validatedReferenceTrack[frameId] = image;
        }
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
            ...(validatedReferenceTrack ? { referenceTrack: validatedReferenceTrack } : {}),
        },
        memoryBytes,
    };
}

/** Build a detached FrameSet value, returning a typed validation error on invalid input. */
export function createFrameSet(input: unknown): TFrameSetValidationResult {
    return validateFrameSet(input);
}

function validateOperationState(state: TActiveFrameSet): TFrameSetError | undefined {
    if (
        !Number.isInteger(state.activeFrameIndex) ||
        state.activeFrameIndex < 0 ||
        state.activeFrameIndex >= state.frameSet.frames.length
    ) {
        return { code: 'invalid-active-index', message: 'Active frame index is out of range' };
    }
    const validation = validateFrameSet(state.frameSet);
    return validation.ok ? undefined : validation.error;
}

function operationResult(
    frames: TFrame[],
    activeFrameIndex: number,
    original: TFrameSet,
    referenceTrack: Record<string, unknown> | undefined = original.referenceTrack,
): TFrameSetOperationResult {
    const sheet = original.sheet
        ? {
              ...original.sheet,
              frameCount: frames.length,
              sheetWidth:
                  original.sheet.cellWidth * frames.length + original.sheet.trailingPaddingPx,
          }
        : undefined;
    const validation = validateFrameSet({
        width: original.width,
        height: original.height,
        frames,
        ...(sheet ? { sheet } : {}),
        ...(referenceTrack ? { referenceTrack } : {}),
    });
    return validation.ok
        ? { ok: true, value: { frameSet: validation.value, activeFrameIndex } }
        : { ok: false, error: validation.error };
}

/** Insert a new frame after the active frame and select it. */
export function addFrame(state: TActiveFrameSet, frame: TFrame): TFrameSetOperationResult {
    const invalidState = validateOperationState(state);
    if (invalidState) return { ok: false, error: invalidState };
    const frames = [...state.frameSet.frames];
    const insertAt = state.activeFrameIndex + 1;
    frames.splice(insertAt, 0, frame);
    return operationResult(frames, insertAt, state.frameSet);
}

/** Duplicate the active frame while assigning caller-supplied unique frame and layer ids. */
export function duplicateFrame(
    state: TActiveFrameSet,
    newFrameId: string,
    newLayerIds: readonly string[],
): TFrameSetOperationResult {
    const invalidState = validateOperationState(state);
    if (invalidState) return { ok: false, error: invalidState };
    const source = state.frameSet.frames[state.activeFrameIndex];
    if (newLayerIds.length !== source.layers.length) {
        return {
            ok: false,
            error: { code: 'invalid-layer-stack', message: 'Duplicate needs one new id per layer' },
        };
    }
    const duplicate: TFrame = {
        ...source,
        id: newFrameId,
        layers: source.layers.map((layer, index) => ({ ...layer, id: newLayerIds[index] })),
    };
    const referenceTrack = state.frameSet.referenceTrack
        ? { ...state.frameSet.referenceTrack }
        : undefined;
    if (referenceTrack?.[source.id] !== undefined) {
        referenceTrack[newFrameId] = referenceTrack[source.id];
    }
    const frames = [...state.frameSet.frames];
    const insertAt = state.activeFrameIndex + 1;
    frames.splice(insertAt, 0, duplicate);
    return operationResult(frames, insertAt, state.frameSet, referenceTrack);
}

/** Delete a frame, refusing to remove the last frame. */
export function deleteFrame(state: TActiveFrameSet, index: number): TFrameSetOperationResult {
    const invalidState = validateOperationState(state);
    if (invalidState) return { ok: false, error: invalidState };
    if (!Number.isInteger(index) || index < 0 || index >= state.frameSet.frames.length) {
        return {
            ok: false,
            error: { code: 'invalid-active-index', message: 'Frame index is out of range' },
        };
    }
    if (state.frameSet.frames.length === 1) {
        return {
            ok: false,
            error: { code: 'last-frame', message: 'The last frame cannot be deleted' },
        };
    }
    const frames = state.frameSet.frames.filter((_, frameIndex) => frameIndex !== index);
    const activeFrameIndex =
        index < state.activeFrameIndex
            ? state.activeFrameIndex - 1
            : index === state.activeFrameIndex
              ? Math.min(index, frames.length - 1)
              : state.activeFrameIndex;
    const referenceTrack = state.frameSet.referenceTrack
        ? Object.fromEntries(
              Object.entries(state.frameSet.referenceTrack).filter(([frameId]) =>
                  frames.some((frame) => frame.id === frameId),
              ),
          )
        : undefined;
    return operationResult(frames, activeFrameIndex, state.frameSet, referenceTrack);
}

/** Move the requested frame one slot left or right and keep the same active frame selected. */
export function moveFrame(
    state: TActiveFrameSet,
    index: number,
    direction: -1 | 1,
): TFrameSetOperationResult {
    const invalidState = validateOperationState(state);
    if (invalidState) return { ok: false, error: invalidState };
    const target = index + direction;
    if (
        !Number.isInteger(index) ||
        index < 0 ||
        target < 0 ||
        target >= state.frameSet.frames.length
    ) {
        return {
            ok: false,
            error: { code: 'invalid-active-index', message: 'Frame cannot move beyond the strip' },
        };
    }
    const frames = [...state.frameSet.frames];
    [frames[index], frames[target]] = [frames[target], frames[index]];
    const activeFrameIndex =
        state.activeFrameIndex === index
            ? target
            : state.activeFrameIndex === target
              ? index
              : state.activeFrameIndex;
    return operationResult(frames, activeFrameIndex, state.frameSet);
}

/** Select a frame without changing its order or ids. */
export function selectFrame(state: TActiveFrameSet, index: number): TFrameSetOperationResult {
    const invalidState = validateOperationState(state);
    if (invalidState) return { ok: false, error: invalidState };
    if (!Number.isInteger(index) || index < 0 || index >= state.frameSet.frames.length) {
        return {
            ok: false,
            error: { code: 'invalid-active-index', message: 'Frame index is out of range' },
        };
    }
    return { ok: true, value: { frameSet: state.frameSet, activeFrameIndex: index } };
}

/** Exposes the per-layer cap used by the canvas for callers that need preflight estimates. */
export { LAYER_MEMORY_BUDGET_BYTES };
