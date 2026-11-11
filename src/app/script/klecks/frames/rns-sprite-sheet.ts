import type { TFrameSheetGeometry } from './frame-set.ts';

export type TRnsSpritePreset = {
    name: string;
    cellWidth: number;
    cellHeight: number;
};

export const RNS_SPRITE_PRESETS: readonly TRnsSpritePreset[] = [
    { name: 'R&S legacy 500x500', cellWidth: 500, cellHeight: 500 },
    { name: 'R&S 600x500', cellWidth: 600, cellHeight: 500 },
    { name: 'R&S 600x510', cellWidth: 600, cellHeight: 510 },
];

export type TRnsDetection = {
    geometry: TFrameSheetGeometry;
    alphaGapAgreement: number;
    preset: TRnsSpritePreset;
};

/** Alpha occupancy by source column; a column is occupied when any pixel has alpha > 0. */
export function detectRnsSpriteGeometry(
    sheetWidth: number,
    sheetHeight: number,
    occupiedColumns: ArrayLike<boolean | number>,
    presets: readonly TRnsSpritePreset[] = RNS_SPRITE_PRESETS,
): TRnsDetection[] {
    if (
        !Number.isSafeInteger(sheetWidth) ||
        !Number.isSafeInteger(sheetHeight) ||
        sheetWidth < 1 ||
        sheetHeight < 1 ||
        occupiedColumns.length !== sheetWidth
    ) {
        return [];
    }
    let lastOccupied = -1;
    for (let x = sheetWidth - 1; x >= 0; x--) {
        if (occupiedColumns[x]) {
            lastOccupied = x;
            break;
        }
    }
    if (lastOccupied < 0) return [];
    const results: TRnsDetection[] = [];
    for (const preset of presets) {
        // A short remainder may be trailing transparent padding. Accept it
        // only when every column in that remainder is transparent.
        const trailingPaddingPx = sheetWidth % preset.cellWidth;
        const contentWidth = sheetWidth - trailingPaddingPx;
        let hasOpaqueTail = false;
        for (let x = contentWidth; x < sheetWidth; x++) {
            if (occupiedColumns[x]) {
                hasOpaqueTail = true;
                break;
            }
        }
        if (hasOpaqueTail) continue;
        if (preset.cellHeight !== sheetHeight || contentWidth % preset.cellWidth !== 0) continue;
        const frameCount = contentWidth / preset.cellWidth;
        if (frameCount < 1) continue;
        let gaps = 0;
        let tested = 0;
        for (let boundary = preset.cellWidth; boundary < contentWidth; boundary += preset.cellWidth) {
            tested++;
            let gap = false;
            for (let offset = -2; offset <= 1; offset++) {
                const x = boundary + offset;
                if (x >= 0 && x < sheetWidth && !occupiedColumns[x]) {
                    gap = true;
                    break;
                }
            }
            if (gap) gaps++;
        }
        results.push({
            preset,
            alphaGapAgreement: tested ? gaps / tested : 1,
            geometry: {
                cellWidth: preset.cellWidth,
                cellHeight: preset.cellHeight,
                frameCount,
                trailingPaddingPx,
                sheetWidth,
                sheetHeight,
            },
        });
    }
    return results.sort((a, b) =>
        b.alphaGapAgreement - a.alphaGapAgreement ||
        b.geometry.frameCount - a.geometry.frameCount ||
        a.preset.cellWidth - b.preset.cellWidth,
    );
}

/** Slice horizontal RGBA cells row by row and retain the trailing columns exactly. */
export function sliceRgbaSpriteSheet(
    pixels: Uint8Array,
    geometry: TFrameSheetGeometry,
): { frames: Uint8Array[]; trailingPixels: Uint8Array } {
    const { cellWidth, cellHeight, frameCount, sheetWidth, sheetHeight, trailingPaddingPx } = geometry;
    if (
        pixels.length !== sheetWidth * sheetHeight * 4 ||
        cellWidth * frameCount + trailingPaddingPx !== sheetWidth ||
        cellHeight !== sheetHeight ||
        ![cellWidth, cellHeight, frameCount, sheetWidth, sheetHeight].every(
            (n) => Number.isSafeInteger(n) && n > 0,
        ) ||
        !Number.isSafeInteger(trailingPaddingPx) ||
        trailingPaddingPx < 0
    ) {
        throw new RangeError('Invalid sprite sheet geometry or RGBA buffer size');
    }
    const rowBytes = sheetWidth * 4;
    const cellRowBytes = cellWidth * 4;
    const frames = Array.from({ length: frameCount }, () => new Uint8Array(cellWidth * cellHeight * 4));
    for (let y = 0; y < cellHeight; y++) {
        for (let index = 0; index < frameCount; index++) {
            const sourceStart = y * rowBytes + index * cellRowBytes;
            frames[index].set(pixels.subarray(sourceStart, sourceStart + cellRowBytes), y * cellRowBytes);
        }
    }
    const tailBytes = trailingPaddingPx * sheetHeight * 4;
    const trailingPixels = new Uint8Array(tailBytes);
    for (let y = 0; y < sheetHeight; y++) {
        const sourceStart = y * rowBytes + frameCount * cellRowBytes;
        trailingPixels.set(pixels.subarray(sourceStart, sourceStart + trailingPaddingPx * 4), y * trailingPaddingPx * 4);
    }
    return { frames, trailingPixels };
}

/** Re-stitch frames and the untouched trailing buffer into the original RGBA sheet geometry. */
export function stitchRgbaSpriteSheet(
    frames: readonly Uint8Array[],
    geometry: TFrameSheetGeometry,
    trailingPixels?: Uint8Array,
): Uint8Array {
    const { cellWidth, cellHeight, frameCount, sheetWidth, sheetHeight, trailingPaddingPx } = geometry;
    const frameBytes = cellWidth * cellHeight * 4;
    const tailBytes = trailingPaddingPx * sheetHeight * 4;
    if (
        frames.length !== frameCount ||
        frames.some((frame) => frame.length !== frameBytes) ||
        cellWidth * frameCount + trailingPaddingPx !== sheetWidth ||
        cellHeight !== sheetHeight ||
        (trailingPixels && trailingPixels.length !== tailBytes)
    ) {
        throw new RangeError('Invalid frames, trailing pixels, or sprite sheet geometry');
    }
    const result = new Uint8Array(sheetWidth * sheetHeight * 4);
    const rowBytes = sheetWidth * 4;
    const cellRowBytes = cellWidth * 4;
    for (let y = 0; y < cellHeight; y++) {
        for (let index = 0; index < frameCount; index++) {
            const destinationStart = y * rowBytes + index * cellRowBytes;
            result.set(frames[index].subarray(y * cellRowBytes, (y + 1) * cellRowBytes), destinationStart);
        }
    }
    if (trailingPixels) {
        for (let y = 0; y < sheetHeight; y++) {
            const destinationStart = y * rowBytes + frameCount * cellRowBytes;
            const tailStart = y * trailingPaddingPx * 4;
            result.set(trailingPixels.subarray(tailStart, tailStart + trailingPaddingPx * 4), destinationStart);
        }
    }
    return result;
}

/** Assemble export cells, replacing only the active cell with its latest flattened pixels. */
export function assembleRnsSpriteSheet(
    framePixels: readonly Uint8Array[],
    geometry: TFrameSheetGeometry,
    trailingPixels: Uint8Array | undefined,
    activeFrameIndex: number,
    activeFramePixels: Uint8Array,
): Uint8Array {
    if (!Number.isInteger(activeFrameIndex) || activeFrameIndex < 0 || activeFrameIndex >= framePixels.length) {
        throw new RangeError('Active frame index is outside the sprite sheet');
    }
    const cells = [...framePixels];
    cells[activeFrameIndex] = activeFramePixels;
    return stitchRgbaSpriteSheet(cells, geometry, trailingPixels);
}

const crcTable = new Uint32Array(256).map((_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
});

function pngChunk(type: string, data: Uint8Array): Uint8Array {
    const result = new Uint8Array(12 + data.length);
    const view = new DataView(result.buffer);
    view.setUint32(0, data.length);
    for (let index = 0; index < 4; index++) result[4 + index] = type.charCodeAt(index);
    result.set(data, 8);
    let crc = 0xffffffff;
    for (let index = 4; index < 8 + data.length; index++) crc = crcTable[(crc ^ result[index]) & 0xff] ^ (crc >>> 8);
    view.setUint32(8 + data.length, (crc ^ 0xffffffff) >>> 0);
    return result;
}

/** Encode raw RGBA without drawing into a browser canvas (wide sprite sheets can exceed canvas limits). */
export async function encodeRgbaPng(pixels: Uint8Array, width: number, height: number): Promise<Blob> {
    if (
        !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
        pixels.length !== width * height * 4 || typeof CompressionStream === 'undefined'
    ) throw new RangeError('Invalid PNG pixels or dimensions');
    const rowSize = width * 4;
    const scanlines = new Uint8Array(height * (rowSize + 1));
    for (let y = 0; y < height; y++) scanlines.set(pixels.subarray(y * rowSize, (y + 1) * rowSize), y * (rowSize + 1) + 1);
    const compressed = new Uint8Array(await new Response(
        new Blob([scanlines.buffer as ArrayBuffer]).stream().pipeThrough(new CompressionStream('deflate')),
    ).arrayBuffer());
    const header = new Uint8Array(13);
    const view = new DataView(header.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    header.set([8, 6, 0, 0, 0], 8);
    const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
        const buffer = new ArrayBuffer(bytes.length);
        new Uint8Array(buffer).set(bytes);
        return buffer;
    };
    return new Blob([
        asArrayBuffer(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])),
        asArrayBuffer(pngChunk('IHDR', header)),
        asArrayBuffer(pngChunk('IDAT', compressed)),
        asArrayBuffer(pngChunk('IEND', new Uint8Array())),
    ], { type: 'image/png' });
}

/** Nearest-neighbor coordinate mapping that preserves the original LQ dimensions. */
export function scaleRgbaNearest(
    source: Uint8Array,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
): Uint8Array {
    if (
        source.length !== sourceWidth * sourceHeight * 4 ||
        ![sourceWidth, sourceHeight, targetWidth, targetHeight].every(
            (n) => Number.isSafeInteger(n) && n > 0,
        )
    ) {
        throw new RangeError('Invalid RGBA scale dimensions');
    }
    const output = new Uint8Array(targetWidth * targetHeight * 4);
    for (let y = 0; y < targetHeight; y++) {
        const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / targetHeight));
        for (let x = 0; x < targetWidth; x++) {
            const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / targetWidth));
            const sourceOffset = (sourceY * sourceWidth + sourceX) * 4;
            output.set(source.subarray(sourceOffset, sourceOffset + 4), (y * targetWidth + x) * 4);
        }
    }
    return output;
}
