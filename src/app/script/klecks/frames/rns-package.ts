/** Minimal browser-side R&S Mods package helpers. Zip output is stored/no-compression. */
export type TRnsPackageFiles = Map<string, Uint8Array>;
export type TRnsAnimationRecord = {
    key: string;
    highQualityPath: string;
    lowQualityPath: string;
};

/** Directory inputs include the selected root in webkitRelativePath; keep the Mods tree on export. */
export function normalizeRnsFolderPath(relativePath: string, fileName: string): string {
    const parts = (relativePath || fileName).replaceAll('\\', '/').split('/').filter(Boolean);
    return parts[0]?.toLowerCase() === 'mods' ? parts.join('/') : ['Mods', ...parts].join('/');
}

export function rnsPackageNameFromPath(path: string, fallback = 'R&S Mod'): string {
    const parts = path.split('/').filter(Boolean);
    return parts[0]?.toLowerCase() === 'mods' ? parts[1] || fallback : fallback;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function parseCsvRows(bytes: Uint8Array): string[][] {
    const text = decoder.decode(bytes).replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') quoted = false;
            else field += char;
        } else if (char === '"') quoted = true;
        else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            if (row.some((cell) => cell !== '')) rows.push(row);
            row = [];
            field = '';
        } else field += char;
    }
    if (field !== '' || row.length) {
        row.push(field);
        if (row.some((cell) => cell !== '')) rows.push(row);
    }
    return rows;
}

function column(headers: string[], choices: string[]): number {
    return headers.findIndex((header) => choices.includes(header.trim().toLowerCase()));
}

export function listRnsAnimations(files: TRnsPackageFiles): TRnsAnimationRecord[] {
    const bytes = files.get('Animations.csv') ?? findByBaseName(files, 'Animations.csv');
    if (!bytes) throw new Error('Mods package is missing Animations.csv');
    if (!files.has('SheetList.csv') && !findByBaseName(files, 'SheetList.csv')) {
        throw new Error('Mods package is missing SheetList.csv');
    }
    const [headers, ...rows] = parseCsvRows(bytes);
    if (!headers) throw new Error('Animations.csv is empty');
    const keyIndex = column(headers, ['key']);
    const highIndex = column(headers, ['filepath']);
    const lowIndex = column(headers, ['filepathlowquality']);
    if (keyIndex < 0 || highIndex < 0 || lowIndex < 0) {
        throw new Error('Animations.csv needs key, filepath, and filepathLowQuality columns');
    }
    return rows.flatMap((row) => {
        const key = row[keyIndex]?.trim();
        const highQualityPath = row[highIndex]?.trim();
        const lowQualityPath = row[lowIndex]?.trim();
        return key && highQualityPath && lowQualityPath
            ? [{ key, highQualityPath, lowQualityPath }]
            : [];
    });
}

function findByBaseName(files: TRnsPackageFiles, name: string): Uint8Array | undefined {
    for (const [path, bytes] of files) {
        if (path.split('/').at(-1) === name) return bytes;
    }
    return undefined;
}

export function applyRnsPackageEdits(
    originalFiles: TRnsPackageFiles,
    highQualityPath: string,
    editedHighQuality: Uint8Array,
    lowQualityPath: string,
    generatedLowQuality: Uint8Array,
): TRnsPackageFiles {
    if (!originalFiles.has(highQualityPath) || !originalFiles.has(lowQualityPath)) {
        throw new Error('Selected HQ/LQ files are missing from the Mods package');
    }
    const result = new Map([...originalFiles].map(([path, data]) => [path, data.slice()]));
    result.set(highQualityPath, editedHighQuality.slice());
    result.set(lowQualityPath, generatedLowQuality.slice());
    return result;
}

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let value = i;
        for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        table[i] = value >>> 0;
    }
    return table;
})();

function crc32(data: Uint8Array): number {
    let value = 0xffffffff;
    for (const byte of data) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

export function writeStoredZip(files: TRnsPackageFiles): Uint8Array {
    const locals: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;
    const viewOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (const [path, data] of files) {
        const name = encoder.encode(path.replaceAll('\\', '/'));
        const crc = crc32(data);
        const local = new Uint8Array(30 + name.length);
        const lv = viewOf(local);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0x0800, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, data.length, true);
        lv.setUint16(26, name.length, true);
        local.set(name, 30);
        locals.push(local, data);
        const record = new Uint8Array(46 + name.length);
        const cv = viewOf(record);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, name.length, true);
        cv.setUint32(42, offset, true);
        record.set(name, 46);
        central.push(record);
        offset += local.length + data.length;
    }
    const centralBytes = concat(central);
    const end = new Uint8Array(22);
    const ev = viewOf(end);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.size, true);
    ev.setUint16(10, files.size, true);
    ev.setUint32(12, centralBytes.length, true);
    ev.setUint32(16, offset, true);
    return concat([...locals, centralBytes, end]);
}

export async function readZipFile(file: Blob): Promise<TRnsPackageFiles> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let endOffset = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            endOffset = i;
            break;
        }
    }
    if (endOffset < 0) throw new Error('Invalid ZIP: end record missing');
    const entryCount = view.getUint16(endOffset + 10, true);
    let cursor = view.getUint32(endOffset + 16, true);
    const files: TRnsPackageFiles = new Map();
    for (let i = 0; i < entryCount; i++) {
        if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Invalid ZIP directory');
        const method = view.getUint16(cursor + 10, true);
        const flags = view.getUint16(cursor + 8, true);
        if (flags & 1) throw new Error('Encrypted ZIP entries are not supported');
        const compressedSize = view.getUint32(cursor + 20, true);
        const uncompressedSize = view.getUint32(cursor + 24, true);
        const nameLength = view.getUint16(cursor + 28, true);
        const extraLength = view.getUint16(cursor + 30, true);
        const commentLength = view.getUint16(cursor + 32, true);
        const localOffset = view.getUint32(cursor + 42, true);
        const path = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
        cursor += 46 + nameLength + extraLength + commentLength;
        if (path.endsWith('/')) continue;
        if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
            throw new Error('ZIP64 packages are not supported');
        }
        if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Invalid ZIP local record');
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = bytes.slice(dataStart, dataStart + compressedSize);
        let data: Uint8Array;
        if (method === 0) data = compressed;
        else if (method === 8 && 'DecompressionStream' in globalThis) {
            const stream = new Blob([compressed]).stream().pipeThrough(
                new DecompressionStream('deflate-raw' as CompressionFormat),
            );
            data = new Uint8Array(await new Response(stream).arrayBuffer());
        } else throw new Error(`Unsupported ZIP compression method: ${method}`);
        files.set(path, data);
    }
    return files;
}
