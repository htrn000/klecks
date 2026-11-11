import { TDeserializedKlStorageProject, TKlProject, TKlProjectMeta, TMixMode, TRawMeta } from '../kl-types';
import {
    PROJECT_STORE_THUMBNAIL_SIZE_PX,
    ProjectConverter,
    TKlStorageProjectRead,
    TKlStorageProjectWrite,
} from './project-converter';
import { LocalStorage } from '../../bb/base/local-storage';
import { IMAGE_DATA_STORE, KL_INDEXED_DB, PROJECT_STORE } from './kl-indexed-db';
import { isBlob, randomUuid } from '../../bb/base/base';
import { TIdb } from './kl-indexed-db.types';
import { BB } from '../../bb/bb';
import { canvasToBlob } from '../../bb/base/canvas';
import { getMixModeStr } from '../canvas/get-mix-mode';

export function isImageDataReference(
    input: unknown,
): input is TIdb['V2']['ProjectStore']['ImageDataRef'] {
    return (
        typeof input === 'object' && input !== null && 'id' in input && typeof input.id === 'string'
    );
}

async function createFallbackThumbnail(): Promise<Blob> {
    // very basic fallback. only affects data stored before version 0.5.1 (2022)
    return await canvasToBlob(
        BB.canvas(PROJECT_STORE_THUMBNAIL_SIZE_PX, PROJECT_STORE_THUMBNAIL_SIZE_PX),
        'image/png',
    );
}

export type TProjectStoreListener = {
    onUpdate: (meta?: TKlProjectMeta) => void;
};

export function getProjectImageDataIds(raw: TIdb['V2']['ProjectStore']['Read']): string[] {
    return [
        ...(isImageDataReference(raw.thumbnail) ? [raw.thumbnail.id] : []),
        ...raw.layers.flatMap((layer) => (isImageDataReference(layer.blob) ? [layer.blob.id] : [])),
        ...(raw.frames?.frames.flatMap((frame) =>
            frame.layers.flatMap((layer) => (isImageDataReference(layer.blob) ? [layer.blob.id] : [])),
        ) ?? []),
    ];
}

/**
 * simplified interface for storing projects into browser storage
 */
export class ProjectStore {
    private listeners: TProjectStoreListener[] = [];
    private isAvailable: boolean = true;
    private currentMeta: TKlProjectMeta | undefined;

    private async lowLevelStore(project: TKlStorageProjectWrite): Promise<void> {
        const imageDataList: { id: string; data: Blob }[] = [];
        const blobRefs = new Map<Blob, { id: string }>();
        const addImageBlob = (data: Blob): { id: string } => {
            const existing = blobRefs.get(data);
            if (existing) return existing;
            const reference = { id: randomUuid() };
            blobRefs.set(data, reference);
            imageDataList.push({ id: reference.id, data });
            return reference;
        };
        const thumbnail = addImageBlob(project.thumbnail);
        const layers: TIdb['V2']['ProjectStore']['Write']['layers'] = [];
        for (const layer of project.layers) {
            const blob = addImageBlob(layer.blob);
            layers.push({
                ...layer,
                blob,
            });
        }
        let frames: TIdb['V2']['ProjectStore']['Write']['frames'];
        if (project.frames) {
            frames = {
                width: project.frames.width,
                height: project.frames.height,
                activeFrameIndex: project.frames.activeFrameIndex,
                ...(project.frames.sheet ? { sheet: { ...project.frames.sheet } } : {}),
                ...(project.frames.rnsPackage ? { rnsPackage: project.frames.rnsPackage } : {}),
                frames: project.frames.frames.map((frame) => ({
                    id: frame.id,
                    ...(frame.thumbnail ? { thumbnail: frame.thumbnail } : {}),
                    layers: frame.layers.map((layer) => ({
                        id: layer.id,
                        name: layer.name,
                        isVisible: layer.isVisible,
                        opacity: layer.opacity,
                        mixModeStr: layer.mixModeStr,
                        hasClipping: layer.hasClipping,
                        blob: addImageBlob(layer.blob),
                    })),
                })),
            };
        }
        const { frames: _projectFrames, ...projectWithoutFrames } = project;
        const raw: TIdb['V2']['ProjectStore']['Write'] = {
            ...projectWithoutFrames,
            thumbnail,
            layers,
            ...(frames ? { frames } : {}),
        };

        await KL_INDEXED_DB.runTransaction(
            [PROJECT_STORE, IMAGE_DATA_STORE],
            'readwrite',
            async (transaction) => {
                // remove old
                const rawOld = await transaction.get(PROJECT_STORE, 1);
                if (rawOld) {
                    await transaction.bulkRemove(IMAGE_DATA_STORE, getProjectImageDataIds(rawOld));
                }
                // save new
                await transaction.bulkSet(
                    IMAGE_DATA_STORE,
                    imageDataList.map(({ id, data }) => ({
                        key: id,
                        value: data,
                    })),
                );
                await transaction.set(PROJECT_STORE, undefined, raw);
            },
            { durability: 'strict' },
        );
    }

    private async lowLevelReadMeta(): Promise<TRawMeta | undefined> {
        const raw = await KL_INDEXED_DB.runTransaction(
            [PROJECT_STORE, IMAGE_DATA_STORE],
            'readonly',
            async (transaction) => {
                const raw = await transaction.get(PROJECT_STORE, 1);
                if (!raw) {
                    return undefined;
                }
                return {
                    projectId: raw.projectId,
                    timestamp: raw.timestamp,
                    thumbnail: isImageDataReference(raw.thumbnail)
                        ? await transaction.get(IMAGE_DATA_STORE, raw.thumbnail.id)
                        : raw.thumbnail,
                };
            },
        );
        if (!raw) {
            return undefined;
        }

        // for now ignores the ImageData case because we only write blobs for browser storage projects
        let thumbnail = isBlob(raw.thumbnail) ? raw.thumbnail : undefined;
        thumbnail = thumbnail ?? (await createFallbackThumbnail());

        return {
            projectId: raw.projectId ?? randomUuid(),
            timestamp: raw.timestamp,
            thumbnail,
        };
    }

    private async lowLevelRead(): Promise<TKlStorageProjectRead | undefined> {
        const transactionResult = await KL_INDEXED_DB.runTransaction(
            [PROJECT_STORE, IMAGE_DATA_STORE],
            'readonly',
            async (transaction) => {
                const raw = await transaction.get(PROJECT_STORE, 1);
                if (!raw) {
                    return undefined;
                }
                const imageDataIds = [...new Set(getProjectImageDataIds(raw))];
                return {
                    imageDataById: await transaction.bulkGet(IMAGE_DATA_STORE, imageDataIds),
                    raw,
                };
            },
        );
        if (!transactionResult) {
            return undefined;
        }

        let thumbnail = isImageDataReference(transactionResult.raw.thumbnail)
            ? transactionResult.imageDataById.get(transactionResult.raw.thumbnail.id)
            : transactionResult.raw.thumbnail;
        // for now ignores the ImageData case because we only write blobs for browser storage projects
        thumbnail = isBlob(thumbnail) ? thumbnail : undefined;
        thumbnail = thumbnail ?? (await createFallbackThumbnail());

        const layers: TKlStorageProjectRead['layers'] = transactionResult.raw.layers.map(
            (layer) => {
                const storedBlob = isImageDataReference(layer.blob)
                    ? transactionResult.imageDataById.get(layer.blob.id)
                    : layer.blob;
                return {
                    ...layer,
                    isVisible: layer.isVisible ?? true,
                    mixModeStr: getMixModeStr(layer.mixModeStr),
                    hasClipping: layer.hasClipping ?? false,
                    // for now ignores the ImageData case because we only write blobs for browser storage projects
                    blob: isBlob(storedBlob) ? storedBlob : undefined,
                };
            },
        );
        let frames: TKlStorageProjectRead['frames'];
        if (transactionResult.raw.frames) {
            frames = {
                width: transactionResult.raw.frames.width,
                height: transactionResult.raw.frames.height,
                activeFrameIndex: transactionResult.raw.frames.activeFrameIndex,
                ...(transactionResult.raw.frames.sheet
                    ? { sheet: { ...transactionResult.raw.frames.sheet } }
                    : {}),
                ...(transactionResult.raw.frames.rnsPackage
                    ? { rnsPackage: transactionResult.raw.frames.rnsPackage }
                    : {}),
                frames: transactionResult.raw.frames.frames.map((frame) => ({
                    id: frame.id,
                    ...(frame.thumbnail ? { thumbnail: frame.thumbnail } : {}),
                    layers: frame.layers.map((layer) => {
                        const storedBlob = isImageDataReference(layer.blob)
                            ? transactionResult.imageDataById.get(layer.blob.id)
                            : layer.blob;
                        return {
                            id: layer.id,
                            name: layer.name,
                            isVisible: layer.isVisible ?? true,
                            opacity: layer.opacity,
                            mixModeStr: getMixModeStr(layer.mixModeStr as TMixMode | undefined),
                            hasClipping: layer.hasClipping ?? false,
                            // Missing image data is left absent for ProjectConverter's fallback.
                            blob: isBlob(storedBlob) ? storedBlob : undefined,
                        };
                    }),
                })),
            };
        }
        const { frames: _storedFrames, ...rawWithoutFrames } = transactionResult.raw;
        return {
            ...rawWithoutFrames,
            projectId: transactionResult.raw.projectId ?? randomUuid(),
            thumbnail,
            layers,
            ...(frames ? { frames } : {}),
        };
    }

    private async lowLevelClear(): Promise<void> {
        await KL_INDEXED_DB.runTransaction(
            [PROJECT_STORE, IMAGE_DATA_STORE],
            'readwrite',
            async (transaction) => {
                const rawOld = await transaction.get(PROJECT_STORE, 1);
                await transaction.remove(PROJECT_STORE, 1);
                if (rawOld) {
                    await transaction.bulkRemove(IMAGE_DATA_STORE, getProjectImageDataIds(rawOld));
                }
            },
        );
    }

    private emit(meta?: TKlProjectMeta): void {
        this.currentMeta = meta ? { ...meta } : undefined;
        this.listeners.forEach((item) => {
            item.onUpdate(meta);
        });
    }

    private updateTimestamp(): void {
        LocalStorage.setItem('indexedDbUpdatedAt', '' + Date.now());
    }

    // ----------------------------------- public -----------------------------------

    constructor() {
        if (!KL_INDEXED_DB.getIsAvailable()) {
            this.isAvailable = false;
            return;
        }

        window.addEventListener('storage', async (e) => {
            if (e.key !== 'indexedDbUpdatedAt' || this.listeners.length === 0) {
                return;
            }
            await this.update();
        });
    }

    async update(): Promise<void> {
        try {
            this.emit(await this.readMeta());
        } catch (e) {
            if (e instanceof Error && e.message.indexOf('db-error') === 0) {
                this.isAvailable = false;
            }
        }
    }

    async read(): Promise<TDeserializedKlStorageProject | undefined> {
        let storageProject: TKlStorageProjectRead | undefined;
        try {
            storageProject = await this.lowLevelRead();
        } catch (e) {
            this.isAvailable = false;
            throw new Error('db-error: ' + e);
        }
        if (!storageProject) {
            return undefined;
        }
        let result;
        try {
            result = await ProjectConverter.readStorageProject(storageProject);
        } catch (e) {
            throw new Error('format-error: ' + e);
        }
        return result;
    }

    async readMeta(): Promise<TKlProjectMeta | undefined> {
        let blobMeta: TRawMeta | undefined;
        try {
            blobMeta = await this.lowLevelReadMeta();
        } catch (e) {
            this.isAvailable = false;
            throw new Error('db-error: ' + e);
        }
        if (!blobMeta) {
            return undefined;
        }
        let result;
        try {
            result = await ProjectConverter.readStorageMeta(blobMeta);
        } catch (e) {
            throw new Error('format-error: ' + e);
        }
        return result;
    }

    async store(project: TKlProject): Promise<void> {
        try {
            const storageProject = await ProjectConverter.createStorageProject(project);
            await this.lowLevelStore(storageProject);
        } catch (e) {
            this.isAvailable = false;
            throw new Error('db-error: ' + e);
        }
        this.updateTimestamp();
        setTimeout(async () => {
            const meta = await this.readMeta();
            this.emit(meta);
        });
    }

    async clear(): Promise<void> {
        await this.lowLevelClear();
        this.updateTimestamp();
        setTimeout(() => this.emit(), 0);
    }

    subscribe(listener: TProjectStoreListener): void {
        if (this.listeners.includes(listener)) {
            return;
        }
        this.listeners.push(listener);
    }

    unsubscribe(listener: TProjectStoreListener): void {
        for (let i = 0; i < this.listeners.length; i++) {
            if (listener === this.listeners[i]) {
                this.listeners.splice(i, 1);
                return;
            }
        }
    }

    getIsAvailable(): boolean {
        this.isAvailable = this.isAvailable && KL_INDEXED_DB.getIsAvailable();
        return this.isAvailable;
    }

    getCurrentMeta(): TKlProjectMeta | undefined {
        return this.currentMeta;
    }
}
