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
type TColorBox = THistogramColor[];

function channelRange(colors: readonly THistogramColor[], channel: 'r' | 'g' | 'b'): number {
    let min = 255;
    let max = 0;
    for (const color of colors) {
        min = Math.min(min, color[channel]);
        max = Math.max(max, color[channel]);
    }
    return max - min;
}

function boxWeight(colors: readonly THistogramColor[]): number {
    return colors.reduce((sum, color) => sum + color.count, 0);
}

function boxRepresentative(colors: readonly THistogramColor[]): TPaletteColor {
    const weight = boxWeight(colors);
    return {
        r: Math.round(colors.reduce((sum, color) => sum + color.r * color.count, 0) / weight),
        g: Math.round(colors.reduce((sum, color) => sum + color.g * color.count, 0) / weight),
        b: Math.round(colors.reduce((sum, color) => sum + color.b * color.count, 0) / weight),
    };
}

/** Median-cut quantization; ties are resolved by channel and RGB order for stable output. */
function quantize(colors: THistogramColor[], maxColors: number): TPaletteColor[] {
    let boxes: TColorBox[] = [colors];
    while (boxes.length < maxColors) {
        let chosen = -1;
        let chosenRange = -1;
        let chosenWeight = -1;
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            if (box.length < 2) continue;
            const range = Math.max(channelRange(box, 'r'), channelRange(box, 'g'), channelRange(box, 'b'));
            const weight = boxWeight(box);
            if (range > chosenRange || (range === chosenRange && weight > chosenWeight)) {
                chosen = i;
                chosenRange = range;
                chosenWeight = weight;
            }
        }
        if (chosen < 0) break;
        const box = boxes[chosen];
        const ranges = { r: channelRange(box, 'r'), g: channelRange(box, 'g'), b: channelRange(box, 'b') };
        const channel = (['r', 'g', 'b'] as const).find((key) => ranges[key] === Math.max(ranges.r, ranges.g, ranges.b))!;
        const sorted = [...box].sort((a, b) => a[channel] - b[channel] || a.r - b.r || a.g - b.g || a.b - b.b);
        const targetWeight = Math.ceil(boxWeight(sorted) / 2);
        let cumulative = 0;
        let split = 1;
        for (let i = 0; i < sorted.length - 1; i++) {
            cumulative += sorted[i].count;
            if (cumulative >= targetWeight) {
                split = i + 1;
                break;
            }
        }
        boxes.splice(chosen, 1, sorted.slice(0, split), sorted.slice(split));
    }
    return boxes.map(boxRepresentative);
}

/** Return exact opaque RGB colors up to 64; use deterministic median-cut above that. */
export function extractPaletteFromRgba(
    pixels: ArrayLike<number>,
    width: number,
    height: number,
    maxColors = MAX_PROJECT_PALETTE_COLORS,
): TProjectPaletteData {
    if (
        !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
        pixels.length !== width * height * 4 || !Number.isInteger(maxColors) || maxColors < 1
    ) return { colors: [] };
    const histogram = new Map<number, THistogramColor>();
    for (let offset = 0; offset < pixels.length; offset += 4) {
        if (!pixels[offset + 3]) continue;
        const color = { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] };
        const key = colorKey(color);
        const existing = histogram.get(key);
        if (existing) existing.count++;
        else histogram.set(key, { ...color, count: 1 });
    }
    const colors = [...histogram.values()];
    if (colors.length <= maxColors) return { colors: colors.map(({ r, g, b }) => ({ r, g, b })) };
    return { colors: quantize(colors, Math.min(maxColors, MAX_PROJECT_PALETTE_COLORS)) };
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
