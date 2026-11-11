import {
    TDeserializedKlStorageProject,
    TKlProject,
    TKlProjectMeta,
    TMixMode,
    TRawMeta,
    TProjectPaletteData,
} from '../kl-types';
import { BB } from '../../bb/bb';
import { drawProject } from '../canvas/draw-project';
import { canvasToBlob } from '../../bb/base/canvas';
import { loadImageFromBlob } from '../../bb/base/load-image';
import {
    projectFramesToStored,
    referenceTrackToStored,
    storedReferenceTrackToProject,
    storedFramesToProject,
    TStoredFrameSet,
} from './project-frame-converter';
import { validateFrameSet } from '../frames/frame-set';

/**
 * project after being read from "browser storage" via "low level" methods
 */
export type TKlStorageProjectRead = {
    id: 1;
    projectId: string;
    timestamp: number;
    thumbnail: Blob; // png
    width: number; // int
    height: number; // int
    layers: {
        name: string;
        isVisible: boolean;
        opacity: number; // 0 - 1
        mixModeStr: TMixMode;
        hasClipping?: boolean;
        blob?: Blob; // png
    }[];
    frames?: TStoredFrameSet<Blob | undefined>;
    referenceTrack?: Record<string, unknown>;
    palette?: TProjectPaletteData;
};
/**
 * project about to be stored into "browser storage" via "low level" methods
 */
export type TKlStorageProjectWrite = {
    id: 1;
    projectId: string;
    timestamp: number;
    thumbnail: Blob; // png
    width: number; // int
    height: number; // int
    layers: {
        name: string;
        isVisible: boolean;
        opacity: number; // 0 - 1
        mixModeStr: TMixMode;
        hasClipping: boolean;
        blob: Blob; // png
    }[];
    frames?: TStoredFrameSet<Blob>;
    referenceTrack?: Record<string, unknown>;
    palette?: TProjectPaletteData;
};

export const PROJECT_STORE_THUMBNAIL_SIZE_PX = 240;

/**
 * for:
 * - preparing project to be stored in ProjectStore
 * - reading a project that came out of the ProjectStore
 */
export class ProjectConverter {
    private static createThumbnail(project: TKlProject): HTMLCanvasElement {
        const size = BB.fitInto(
            project.width,
            project.height,
            PROJECT_STORE_THUMBNAIL_SIZE_PX,
            PROJECT_STORE_THUMBNAIL_SIZE_PX,
        );
        const factor = size.width / project.width;
        return drawProject(project, factor);
    }

    static async createStorageProject(project: TKlProject): Promise<TKlStorageProjectWrite> {
        const canvasBlobCache = new WeakMap<HTMLCanvasElement, Promise<Blob>>();
        const toFrameBlob = async (image: unknown): Promise<Blob> => {
            if (image instanceof Blob) {
                return image;
            }
            if (image instanceof HTMLCanvasElement) {
                let promise = canvasBlobCache.get(image);
                if (!promise) {
                    promise = canvasToBlob(image, 'image/png');
                    canvasBlobCache.set(image, promise);
                }
                return promise;
            }
            if (image instanceof HTMLImageElement) {
                const canvas = BB.canvas(project.width, project.height);
                BB.ctx(canvas).drawImage(image, 0, 0);
                try {
                    return await canvasToBlob(canvas, 'image/png');
                } finally {
                    BB.freeCanvas(canvas);
                }
            }
            throw new Error('Unsupported frame layer image');
        };
        const layers: TKlStorageProjectWrite['layers'] = [];
        for (const item of project.layers) {
            const blob = await toFrameBlob(item.image);
            layers.push({
                name: item.name,
                isVisible: item.isVisible,
                opacity: item.opacity,
                mixModeStr: item.mixModeStr,
                hasClipping: item.hasClipping,
                blob,
            });
        }

        const frames = await projectFramesToStored(project.frames, toFrameBlob);
        const referenceTrack = await referenceTrackToStored(project.referenceTrack, toFrameBlob);

        return {
            id: 1,
            projectId: project.projectId,
            timestamp: Date.now(),
            thumbnail: await canvasToBlob(ProjectConverter.createThumbnail(project), 'image/png'),
            width: project.width,
            height: project.height,
            layers,
            ...(frames ? { frames } : {}),
            ...(referenceTrack ? { referenceTrack } : {}),
            ...(project.palette ? { palette: project.palette } : {}),
        };
    }

    static async readStorageProject(
        storageProject: TKlStorageProjectRead,
    ): Promise<TDeserializedKlStorageProject> {
        if (
            !storageProject.width ||
            !storageProject.height ||
            isNaN(storageProject.width) ||
            isNaN(storageProject.height) ||
            storageProject.width < 1 ||
            storageProject.height < 1
        ) {
            throw new Error(
                'readStorageProject invalid canvas size: ' +
                    storageProject.width +
                    ', ' +
                    storageProject.height,
            );
        }
        const framesWithImages = await storedFramesToProject(storageProject.frames, async (blob) => {
            if (blob instanceof Blob) {
                return loadImageFromBlob(blob).catch(
                    () => new Image(storageProject.width, storageProject.height),
                );
            }
            return new Image(storageProject.width, storageProject.height);
        });
        const referenceTrack = await storedReferenceTrackToProject(
            storageProject.referenceTrack,
            async (blob) => {
                if (blob instanceof Blob) {
                    return loadImageFromBlob(blob).catch(
                        () => new Image(storageProject.width, storageProject.height),
                    );
                }
                return new Image(storageProject.width, storageProject.height);
            },
        );
        let frames: TKlProject['frames'];
        if (framesWithImages) {
            const { activeFrameIndex, ...frameSet } = framesWithImages;
            const validation = validateFrameSet(frameSet);
            if (
                !validation.ok ||
                !Number.isInteger(activeFrameIndex) ||
                activeFrameIndex < 0 ||
                activeFrameIndex >= validation.value.frames.length
            ) {
                throw new Error('readStorageProject invalid FrameSet');
            }
            frames = { ...validation.value, activeFrameIndex };
        }
        const project: TKlProject = {
            projectId: storageProject.projectId,
            width: storageProject.width,
            height: storageProject.height,
            layers: (
                await Promise.all(
                    storageProject.layers.map((layer) => {
                        if (layer.blob) {
                            return loadImageFromBlob(layer.blob).catch(
                                () => new Image(storageProject.width, storageProject.height),
                            );
                        }
                        return new Image(storageProject.width, storageProject.height);
                    }),
                )
            ).map((image, i) => {
                const storageLayer = storageProject.layers[i];
                return {
                    name: storageLayer.name,
                    isVisible: storageLayer.isVisible,
                    opacity: storageLayer.opacity,
                    mixModeStr: storageLayer.mixModeStr,
                    hasClipping: storageLayer.hasClipping ?? false,
                    image,
                };
            }),
            ...(frames ? { frames } : {}),
            ...(referenceTrack ? { referenceTrack } : {}),
            ...(storageProject.palette ? { palette: storageProject.palette } : {}),
        };

        return {
            project: project,
            timestamp: storageProject.timestamp,
            thumbnail: await loadImageFromBlob(storageProject.thumbnail).catch(
                () => new Image(PROJECT_STORE_THUMBNAIL_SIZE_PX, PROJECT_STORE_THUMBNAIL_SIZE_PX),
            ),
        };
    }

    static async readStorageMeta(rawMeta: TRawMeta): Promise<TKlProjectMeta> {
        return {
            projectId: rawMeta.projectId,
            timestamp: rawMeta.timestamp,
            thumbnail: rawMeta.thumbnail
                ? await loadImageFromBlob(rawMeta.thumbnail).catch(
                      () =>
                          new Image(
                              PROJECT_STORE_THUMBNAIL_SIZE_PX,
                              PROJECT_STORE_THUMBNAIL_SIZE_PX,
                          ),
                  )
                : BB.canvas(10, 10),
        };
    }
}
