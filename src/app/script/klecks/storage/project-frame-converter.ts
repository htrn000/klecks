import type {
    TFrame,
    TFrameLayer,
    TFrameSetPayload,
} from '../frames/frame-set';

export type TStoredFrameLayer<TImage> = Omit<TFrameLayer, 'image'> & { blob: TImage };
export type TStoredFrame<TImage> = Omit<TFrame, 'layers'> & {
    layers: TStoredFrameLayer<TImage>[];
};
export type TStoredFrameSet<TImage> = Omit<TFrameSetPayload, 'frames' | 'referenceTrack'> & {
    frames: TStoredFrame<TImage>[];
    referenceTrack?: Record<string, TImage>;
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
        ...(frameSet.referenceTrack
            ? {
                  referenceTrack: Object.fromEntries(
                      await Promise.all(
                          Object.entries(frameSet.referenceTrack).map(async ([frameId, image]) => [
                              frameId,
                              await storeImage(
                                  image,
                                  frameSet.frames.findIndex((frame) => frame.id === frameId),
                                  -1,
                              ),
                          ]),
                      ),
                  ),
              }
            : {}),
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
        ...(frameSet.referenceTrack
            ? {
                  referenceTrack: Object.fromEntries(
                      await Promise.all(
                          Object.entries(frameSet.referenceTrack).map(async ([frameId, blob]) => [
                              frameId,
                              await loadImage(
                                  blob,
                                  frameSet.frames.findIndex((frame) => frame.id === frameId),
                                  -1,
                              ),
                          ]),
                      ),
                  ),
              }
            : {}),
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

/** Convert the project's P12 reference slot using the same PNG image codec as layers. */
export async function referenceTrackToStored<TImage>(
    referenceTrack: Record<string, unknown> | undefined,
    storeImage: (image: unknown, frameId: string) => TImage | Promise<TImage>,
): Promise<Record<string, TImage> | undefined> {
    if (!referenceTrack) return undefined;
    return Object.fromEntries(
        await Promise.all(
            Object.entries(referenceTrack).map(async ([frameId, image]) => [
                frameId,
                await storeImage(image, frameId),
            ]),
        ),
    );
}

/** Restore the project's P12 reference slot to app image handles. */
export async function storedReferenceTrackToProject<TImage>(
    referenceTrack: Record<string, unknown> | undefined,
    loadImage: (blob: unknown, frameId: string) => TImage | Promise<TImage>,
): Promise<Record<string, TImage> | undefined> {
    if (!referenceTrack) return undefined;
    return Object.fromEntries(
        await Promise.all(
            Object.entries(referenceTrack).map(async ([frameId, blob]) => [
                frameId,
                await loadImage(blob, frameId),
            ]),
        ),
    );
}
