import gifenc from 'gifenc';

const { GIFEncoder, applyPalette, quantize } = gifenc;

export type TRgbaFrame = { width: number; height: number; pixels: Uint8Array };
export type TGifExportOptions = {
    fps: number;
    loop: 'forever' | 'once';
    transparency: boolean;
    scale: 1 | 2 | 4;
    background?: { r: number; g: number; b: number };
};

export function selectGifFrameRange<T>(frames: readonly T[], from: number, to: number): T[] {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > frames.length) {
        throw new RangeError('GIF frame range is invalid');
    }
    return frames.slice(from - 1, to);
}

/** Distribute centisecond rounding error across frames; 12 fps becomes 8,9,8,8,8,9... */
export function fpsToCentisecondDelays(fps: number, frameCount: number): number[] {
    if (!Number.isFinite(fps) || fps <= 0 || fps > 100 || !Number.isInteger(frameCount) || frameCount < 0) {
        throw new RangeError('FPS and frame count must be positive and supported');
    }
    return Array.from({ length: frameCount }, (_, index) =>
        Math.max(1, Math.round(((index + 1) * 100) / fps) - Math.round((index * 100) / fps)),
    );
}

export function prepareGifPixels(
    pixels: Uint8Array,
    transparency: boolean,
    background = { r: 255, g: 255, b: 255 },
): Uint8Array {
    if (pixels.length % 4 !== 0) throw new RangeError('RGBA pixel data length must be divisible by four');
    const result = pixels.slice();
    for (let i = 0; i < result.length; i += 4) {
        const alpha = result[i + 3];
        if (transparency) {
            if (alpha < 128) {
                result[i] = result[i + 1] = result[i + 2] = 0;
                result[i + 3] = 0;
            } else result[i + 3] = 255;
        } else {
            const inverseAlpha = 255 - alpha;
            result[i] = Math.round((result[i] * alpha + background.r * inverseAlpha) / 255);
            result[i + 1] = Math.round((result[i + 1] * alpha + background.g * inverseAlpha) / 255);
            result[i + 2] = Math.round((result[i + 2] * alpha + background.b * inverseAlpha) / 255);
            result[i + 3] = 255;
        }
    }
    return result;
}

export function scaleRgbaNearest(
    pixels: Uint8Array,
    width: number,
    height: number,
    scale: 1 | 2 | 4,
): TRgbaFrame {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || pixels.length !== width * height * 4) {
        throw new RangeError('RGBA frame dimensions are invalid');
    }
    const targetWidth = width * scale;
    const targetHeight = height * scale;
    if (
        targetWidth > 65535 || targetHeight > 65535 ||
        !Number.isSafeInteger(targetWidth * targetHeight * 4)
    ) throw new RangeError('Scaled frame is too large for GIF dimensions');
    if (scale === 1) return { width, height, pixels: pixels.slice() };
    const output = new Uint8Array(targetWidth * targetHeight * 4);
    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const sourceOffset = (Math.floor(y / scale) * width + Math.floor(x / scale)) * 4;
            output.set(pixels.subarray(sourceOffset, sourceOffset + 4), (y * targetWidth + x) * 4);
        }
    }
    return { width: targetWidth, height: targetHeight, pixels: output };
}

function addTransparentEntry(palette: number[][]): number {
    const index = palette.findIndex((color) => color.length > 3 && color[3] < 128);
    if (index >= 0) return index;
    if (palette.length >= 256) palette.pop();
    palette.unshift([0, 0, 0, 0]);
    return 0;
}

function sampleFrames(frames: readonly TRgbaFrame[], maxPixels = 500_000): Uint8Array {
    const totalPixels = frames.reduce((sum, frame) => sum + frame.width * frame.height, 0);
    const stride = Math.max(1, Math.ceil(totalPixels / maxPixels));
    const sampleCount = Math.ceil(totalPixels / stride);
    const samples = new Uint8Array(sampleCount * 4);
    let out = 0;
    let globalPixel = 0;
    for (const frame of frames) {
        for (let i = 0; i < frame.pixels.length; i += 4, globalPixel++) {
            if (globalPixel % stride !== 0) continue;
            samples.set(frame.pixels.subarray(i, i + 4), out);
            out += 4;
        }
    }
    return out === samples.length ? samples : samples.slice(0, out);
}

type TFrameEncoding = { palette: number[][]; index: Uint8Array; transparentIndex: number };

function createGlobalEncodings(frames: readonly TRgbaFrame[], transparency: boolean): TFrameEncoding[] {
    const format = transparency ? 'rgba4444' : 'rgb565';
    const palette = quantize(sampleFrames(frames), transparency ? 255 : 256, {
        format,
        ...(transparency ? { oneBitAlpha: 128 } : {}),
    }) as number[][];
    const transparentIndex = transparency ? addTransparentEntry(palette) : -1;
    return frames.map((frame) => ({
        palette,
        index: applyPalette(frame.pixels, palette, format) as Uint8Array,
        transparentIndex,
    }));
}

function createLocalEncodings(frames: readonly TRgbaFrame[], transparency: boolean): TFrameEncoding[] {
    const format = transparency ? 'rgba4444' : 'rgb565';
    return frames.map((frame) => {
        const palette = quantize(frame.pixels, transparency ? 255 : 256, {
            format,
            ...(transparency ? { oneBitAlpha: 128 } : {}),
        }) as number[][];
        const transparentIndex = transparency ? addTransparentEntry(palette) : -1;
        return {
            palette,
            index: applyPalette(frame.pixels, palette, format) as Uint8Array,
            transparentIndex,
        };
    });
}

/** gifenc's delay option is milliseconds and rounds to centiseconds internally. */
export function encodeGifFrames(
    inputFrames: readonly TRgbaFrame[],
    options: TGifExportOptions,
    onProgress?: (progress: number) => void,
): Uint8Array {
    if (!inputFrames.length) throw new RangeError('At least one GIF frame is required');
    const { width, height } = inputFrames[0];
    if (inputFrames.some((frame) => frame.width !== width || frame.height !== height || frame.pixels.length !== width * height * 4)) {
        throw new RangeError('GIF frames must have equal, valid dimensions');
    }
    const prepared = inputFrames.map((frame) => {
        const composited = prepareGifPixels(frame.pixels, options.transparency, options.background);
        return scaleRgbaNearest(composited, width, height, options.scale);
    });
    const delays = fpsToCentisecondDelays(options.fps, prepared.length);
    let encodings: TFrameEncoding[];
    try {
        encodings = createGlobalEncodings(prepared, options.transparency);
    } catch {
        encodings = createLocalEncodings(prepared, options.transparency);
    }
    const useGlobalPalette = encodings.every((frame) => frame.palette === encodings[0].palette);
    const gif = GIFEncoder({ initialCapacity: Math.max(4096, prepared[0].width * prepared[0].height) });
    encodings.forEach((frame, index) => {
        gif.writeFrame(frame.index, prepared[index].width, prepared[index].height, {
            palette: index === 0 || !useGlobalPalette ? frame.palette : undefined,
            delay: delays[index] * 10,
            repeat: index === 0 && options.loop === 'once' ? -1 : 0,
            transparent: options.transparency,
            transparentIndex: frame.transparentIndex,
            dispose: options.transparency ? 2 : 0,
        });
        onProgress?.((index + 1) / encodings.length);
    });
    gif.finish();
    return gif.bytes();
}
