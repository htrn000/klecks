import type {
    TFrame,
    TFrameLayer,
    TFrameSetPayload,
} from '../frames/frame-set';

export type TStoredFrameLayer<TImage> = Omit<TFrameLayer, 'image'> & { blob: TImage };
export type TStoredFrame<TImage> = Omit<TFrame, 'layers'> & {
    layers: TStoredFrameLayer<TImage>[];
};
export type TStoredFrameSet<TImage> = Omit<TFrameSetPayload, 'frames'> & {
    frames: TStoredFrame<TImage>[];
};

/** Pure metadata/image-handle conversion shared by ProjectConverter and Node tests. */
export async function projectFramesToStored<TImage>(
    frameSet: TFrameSetPayload | undefined,
    storeImage: (image: unknown, frameIndex: number, layerIndex: number) => TImage | Promise<TImage>,
): Promise<TStoredFrameSet<TImage> | undefined> {
    if (!frameSet) return undefined;
    return {
        width: frameSet.width,
        height: frameSet.height,
        activeFrameIndex: frameSet.activeFrameIndex,
        ...(frameSet.sheet ? { sheet: { ...frameSet.sheet } } : {}),
        frames: await Promise.all(
            frameSet.frames.map(async (frame, frameIndex) => ({
                id: frame.id,
                ...(typeof frame.thumbnail === 'string' ? { thumbnail: frame.thumbnail } : {}),
                layers: await Promise.all(
                    frame.layers.map(async (layer, layerIndex) => {
                        const { image, ...metadata } = layer;
                        return {
                            ...metadata,
                            blob: await storeImage(image, frameIndex, layerIndex),
                        };
                    }),
                ),
            })),
        ),
    };
}

/** Restore project-shaped image handles and preserve all FrameSet metadata. */
export async function storedFramesToProject<TImage>(
    frameSet: TStoredFrameSet<unknown> | undefined,
    loadImage: (blob: unknown, frameIndex: number, layerIndex: number) => TImage | Promise<TImage>,
): Promise<(TFrameSetPayload & { frames: (TFrame & { layers: (TFrameLayer & { image: TImage })[] })[] }) | undefined> {
    if (!frameSet) return undefined;
    return {
        width: frameSet.width,
        height: frameSet.height,
        activeFrameIndex: frameSet.activeFrameIndex,
        ...(frameSet.sheet ? { sheet: { ...frameSet.sheet } } : {}),
        frames: await Promise.all(
            frameSet.frames.map(async (frame, frameIndex) => ({
                id: frame.id,
                ...(typeof frame.thumbnail === 'string' ? { thumbnail: frame.thumbnail } : {}),
                layers: await Promise.all(
                    frame.layers.map(async (layer, layerIndex) => {
                        const { blob, ...metadata } = layer;
                        return {
                            ...metadata,
                            image: await loadImage(blob, frameIndex, layerIndex),
                        };
                    }),
                ),
            })),
        ),
    };
}
