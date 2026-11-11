export const MAX_PROJECT_PALETTE_COLORS = 64;

export type TPaletteColor = {
    r: number;
    g: number;
    b: number;
};

export type TProjectPaletteData = {
    [key: string]: unknown;
    colors: TPaletteColor[];
};

const isChannel = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;

export function normalizePalette(input: unknown): TProjectPaletteData {
    if (typeof input !== 'object' || input === null || !('colors' in input) || !Array.isArray(input.colors)) {
        return { colors: [] };
    }
    const colors: TPaletteColor[] = [];
    const seen = new Set<number>();
    for (const color of input.colors) {
        if (
            typeof color !== 'object' || color === null ||
            !isChannel((color as any).r) || !isChannel((color as any).g) || !isChannel((color as any).b)
        ) continue;
        const key = ((color as any).r << 16) | ((color as any).g << 8) | (color as any).b;
        if (seen.has(key)) continue;
        seen.add(key);
        colors.push({ r: (color as any).r, g: (color as any).g, b: (color as any).b });
        if (colors.length === MAX_PROJECT_PALETTE_COLORS) break;
    }
    return { colors };
}

export function addPaletteColor(palette: unknown, color: unknown): TProjectPaletteData {
    const normalized = normalizePalette(palette);
    const next = normalizePalette({ colors: [...normalized.colors, color] });
    return next;
}

export function removePaletteColor(palette: unknown, index: number): TProjectPaletteData {
    const normalized = normalizePalette(palette);
    if (!Number.isInteger(index) || index < 0 || index >= normalized.colors.length) return normalized;
    return { colors: normalized.colors.filter((_, colorIndex) => colorIndex !== index) };
}

export function movePaletteColor(palette: unknown, from: number, to: number): TProjectPaletteData {
    const normalized = normalizePalette(palette);
    if (
        !Number.isInteger(from) || !Number.isInteger(to) ||
        from < 0 || from >= normalized.colors.length || to < 0 || to >= normalized.colors.length || from === to
    ) return normalized;
    const colors = [...normalized.colors];
    const [color] = colors.splice(from, 1);
    colors.splice(to, 0, color);
    return { colors };
}

function colorKey(color: TPaletteColor): number {
    return (color.r << 16) | (color.g << 8) | color.b;
}

type THistogramColor = TPaletteColor & { count: number };
type TColorCluster = { representative: TPaletteColor; count: number };

const PALETTE_MERGE_DISTANCE_SQUARED = 3 * 12 ** 2;

function rgbDistanceSquared(a: TPaletteColor, b: TPaletteColor): number {
    return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

/** Merge nearby shades into the most frequent shade, then retain the most common clusters. */
function mergeAndCap(colors: THistogramColor[], maxColors: number): TPaletteColor[] {
    const sorted = [...colors].sort((a, b) => b.count - a.count || colorKey(a) - colorKey(b));
    const clusters: TColorCluster[] = [];
    for (const color of sorted) {
        const cluster = clusters.find((item) => rgbDistanceSquared(item.representative, color) <= PALETTE_MERGE_DISTANCE_SQUARED);
        if (cluster) cluster.count += color.count;
        else clusters.push({ representative: { r: color.r, g: color.g, b: color.b }, count: color.count });
    }
    return clusters
        .sort((a, b) => b.count - a.count || colorKey(a.representative) - colorKey(b.representative))
        .slice(0, maxColors)
        .map((cluster) => cluster.representative);
}

/** Keep up to 64 exact colors; above that, merge antialiased shades and favor frequent opaque pixels. */
export function extractPaletteFromRgba(
    pixels: ArrayLike<number>,
    width: number,
    height: number,
    maxColors = MAX_PROJECT_PALETTE_COLORS,
): TProjectPaletteData {
    const colorLimit = Math.min(maxColors, MAX_PROJECT_PALETTE_COLORS);
    if (
        !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
        pixels.length !== width * height * 4 || !Number.isInteger(maxColors) || colorLimit < 1
    ) return { colors: [] };
    const histogram = new Map<number, THistogramColor>();
    let uniqueColorCount = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
        if (!pixels[offset + 3]) continue;
        const color = { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] };
        const key = colorKey(color);
        const existing = histogram.get(key);
        if (existing) existing.count++;
        else {
            uniqueColorCount++;
            histogram.set(key, { ...color, count: 1 });
        }
    }
    if (uniqueColorCount <= colorLimit) return { colors: [...histogram.values()].map(({ r, g, b }) => ({ r, g, b })) };

    const opaqueHistogram = new Map<number, THistogramColor>();
    for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 3] < 128) continue;
        const color = { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] };
        const key = colorKey(color);
        const existing = opaqueHistogram.get(key);
        if (existing) existing.count++;
        else opaqueHistogram.set(key, { ...color, count: 1 });
    }
    return {
        colors: mergeAndCap([...opaqueHistogram.values()], colorLimit),
    };
}

export function serializeHexPalette(palette: unknown): string {
    return normalizePalette(palette).colors
        .map(({ r, g, b }) => `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`)
        .join('\n') + (normalizePalette(palette).colors.length ? '\n' : '');
}

export function parseHexPalette(text: string): TProjectPaletteData {
    const colors: TPaletteColor[] = [];
    for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        const trimmed = line.trim();
        const match = /^#?([\da-f]{6})$/i.exec(trimmed);
        if (!match) continue;
        const value = match[1];
        colors.push({
            r: Number.parseInt(value.slice(0, 2), 16),
            g: Number.parseInt(value.slice(2, 4), 16),
            b: Number.parseInt(value.slice(4, 6), 16),
        });
        if (colors.length === MAX_PROJECT_PALETTE_COLORS) break;
    }
    return normalizePalette({ colors });
}

export function serializeGplPalette(palette: unknown, name = 'Klecks Palette'): string {
    const colors = normalizePalette(palette).colors;
    return [
        'GIMP Palette',
        `Name: ${name.replace(/[\r\n]/g, ' ')}`,
        'Columns: 8',
        '#',
        ...colors.map((color, index) => `${color.r}\t${color.g}\t${color.b}\tColor ${index + 1}`),
        '',
    ].join('\n');
}

export function parseGplPalette(text: string): TProjectPaletteData {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    if (lines[0]?.trim() !== 'GIMP Palette') return { colors: [] };
    const colors: TPaletteColor[] = [];
    for (const line of lines.slice(1)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || /^(Name|Columns):/i.test(trimmed)) continue;
        const match = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+.*)?$/.exec(trimmed);
        if (!match) continue;
        const color = { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
        if (![color.r, color.g, color.b].every(isChannel)) continue;
        colors.push(color);
        if (colors.length === MAX_PROJECT_PALETTE_COLORS) break;
    }
    return normalizePalette({ colors });
}
