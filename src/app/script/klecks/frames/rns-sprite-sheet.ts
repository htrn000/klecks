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

/** Slice one-row RGBA sheets into frame-sized RGBA buffers and retain all trailing bytes. */
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
    const frameBytes = cellWidth * cellHeight * 4;
    const frames = Array.from({ length: frameCount }, (_, index) =>
        pixels.slice(index * frameBytes, (index + 1) * frameBytes),
    );
    const tailBytes = trailingPaddingPx * sheetHeight * 4;
    return { frames, trailingPixels: pixels.slice(pixels.length - tailBytes) };
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
    frames.forEach((frame, index) => result.set(frame, index * frameBytes));
    if (trailingPixels) result.set(trailingPixels, frameBytes * frameCount);
    return result;
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
