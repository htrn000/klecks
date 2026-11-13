import type { TKlStorageProjectWrite } from './project-converter.ts';
import { encodeRemoteRecord } from './remote-project-store.ts';

export const KLECKS_PROJECT_FILE_FORMAT = 'klecks-project';
export const KLECKS_PROJECT_FILE_VERSION = 1;
export const KLECKS_PROJECT_FILE_MIME = 'application/x-klecks+json';

export type TProjectFile = {
    format: typeof KLECKS_PROJECT_FILE_FORMAT;
    version: typeof KLECKS_PROJECT_FILE_VERSION;
    name: string;
    savedAt: number;
    project: Record<string, unknown>;
    blobs: Record<string, string>;
};

/** Serialize the same storage record and binary blob references used by the server store. */
export async function encodeProjectFile(
    record: TKlStorageProjectWrite,
    name: string,
    now = Date.now(),
): Promise<string> {
    const encoded = await encodeRemoteRecord(record);
    const file: TProjectFile = {
        format: KLECKS_PROJECT_FILE_FORMAT,
        version: KLECKS_PROJECT_FILE_VERSION,
        name,
        savedAt: now,
        project: encoded.project,
        blobs: encoded.blobs,
    };
    return JSON.stringify(file, null, 2);
}

export function parseProjectFile(text: string): TProjectFile {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        throw new Error('Invalid project file JSON');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Not a Klecks project file');
    }
    const data = value as Record<string, unknown>;
    if (data.format !== KLECKS_PROJECT_FILE_FORMAT) {
        throw new Error('Not a Klecks project file');
    }
    if (data.version !== KLECKS_PROJECT_FILE_VERSION) {
        throw new Error('Unsupported project file version');
    }
    if (
        typeof data.name !== 'string' ||
        typeof data.savedAt !== 'number' ||
        !data.project || typeof data.project !== 'object' || Array.isArray(data.project) ||
        !data.blobs || typeof data.blobs !== 'object' || Array.isArray(data.blobs)
    ) {
        throw new Error('Not a Klecks project file');
    }
    return data as TProjectFile;
}
