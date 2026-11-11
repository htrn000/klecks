declare module 'gifenc' {
    export type GifPalette = number[][];
    export type GifEncoder = {
        writeFrame(index: Uint8Array, width: number, height: number, options?: {
            palette?: GifPalette;
            delay?: number;
            repeat?: number;
            transparent?: boolean;
            transparentIndex?: number;
            dispose?: number;
        }): void;
        finish(): void;
        bytes(): Uint8Array;
    };
    export function GIFEncoder(options?: { initialCapacity?: number }): GifEncoder;
    export function quantize(
        pixels: Uint8Array,
        maxColors: number,
        options?: { format?: string; oneBitAlpha?: boolean | number },
    ): GifPalette;
    export function applyPalette(pixels: Uint8Array, palette: GifPalette, format?: string): Uint8Array;
    const gifenc: {
        GIFEncoder: typeof GIFEncoder;
        quantize: typeof quantize;
        applyPalette: typeof applyPalette;
    };
    export default gifenc;
}
