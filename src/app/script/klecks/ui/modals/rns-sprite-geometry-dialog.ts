import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { showModal } from './base/show-modal';
import { detectRnsSpriteGeometry, RNS_SPRITE_PRESETS } from '../../frames/rns-sprite-sheet';
import type { TFrameSheetGeometry } from '../../frames/frame-set';

export function showRnsSpriteGeometryDialog(p: {
    sheetWidth: number;
    sheetHeight: number;
    occupiedColumns: Uint8Array;
    onConfirm: (geometry: TFrameSheetGeometry) => void;
    onCancel?: () => void;
}): void {
    const suggestions = detectRnsSpriteGeometry(p.sheetWidth, p.sheetHeight, p.occupiedColumns);
    const selected = suggestions[0];
    const presetSelect = BB.el({ tagName: 'select', className: 'kl-input' }) as HTMLSelectElement;
    for (const preset of RNS_SPRITE_PRESETS) {
        const option = BB.el({ tagName: 'option', textContent: preset.name }) as HTMLOptionElement;
        option.value = `${preset.cellWidth}x${preset.cellHeight}`;
        option.selected = selected?.preset.name === preset.name;
        presetSelect.append(option);
    }
    const width = field(selected?.geometry.cellWidth ?? Math.min(500, p.sheetWidth));
    const height = field(selected?.geometry.cellHeight ?? p.sheetHeight);
    const count = field(selected?.geometry.frameCount ?? 1);
    const tail = field(selected?.geometry.trailingPaddingPx ?? 0);
    const suggestion = BB.el({
        textContent: suggestions.length
            ? LANG('rns-geometry-suggested', { x: suggestions.map((entry) => `${entry.preset.name} (${entry.geometry.frameCount} frames, ${entry.geometry.trailingPaddingPx}px tail; alpha-gap ${Math.round(entry.alphaGapAgreement * 100)}%)`).join('; ') })
            : LANG('rns-no-preset-match'),
        css: { margin: '8px 0', color: '#aaa', maxWidth: 500 },
    });
    presetSelect.onchange = () => {
        const preset = RNS_SPRITE_PRESETS.find((entry) => presetSelect.value === `${entry.cellWidth}x${entry.cellHeight}`);
        if (!preset) return;
        width.value = String(preset.cellWidth);
        height.value = String(preset.cellHeight);
        count.value = String(Math.floor(p.sheetWidth / preset.cellWidth));
        tail.value = String(p.sheetWidth % preset.cellWidth);
    };
    const content = BB.el({
        content: [
            fieldRow(LANG('rns-label-preset'), presetSelect),
            fieldRow(LANG('rns-label-cell-width'), width),
            fieldRow(LANG('rns-label-cell-height'), height),
            fieldRow(LANG('rns-label-frame-count'), count),
            fieldRow(LANG('rns-label-tail'), tail),
            suggestion,
        ],
        css: { display: 'grid', gap: 6, minWidth: 350 },
    });
    showModal({
        message: `<b>${LANG('rns-geometry-title')}</b>`,
        div: content,
        buttons: [{ id: 'import', label: LANG('rns-import-frames') }, 'Cancel'],
        primaries: ['import'],
        callback: (result) => {
            if (result !== 'import') {
                p.onCancel?.();
                return;
            }
            const cellWidth = Number(width.value);
            const cellHeight = Number(height.value);
            const frameCount = Number(count.value);
            const trailingPaddingPx = Number(tail.value);
            if (
                ![cellWidth, cellHeight, frameCount, trailingPaddingPx].every(Number.isSafeInteger) ||
                cellWidth < 1 || cellHeight !== p.sheetHeight || frameCount < 1 || trailingPaddingPx < 0 ||
                cellWidth * frameCount + trailingPaddingPx !== p.sheetWidth
            ) {
                alert(LANG('rns-invalid-geometry'));
                p.onCancel?.();
                return;
            }
            p.onConfirm({
                cellWidth,
                cellHeight,
                frameCount,
                trailingPaddingPx,
                sheetWidth: p.sheetWidth,
                sheetHeight: p.sheetHeight,
            });
        },
    });
}

function field(value: number): HTMLInputElement {
    const input = BB.el({ tagName: 'input', className: 'kl-input' }) as HTMLInputElement;
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.value = String(value);
    input.style.width = '100px';
    return input;
}

function fieldRow(label: string, input: HTMLElement): HTMLElement {
    return BB.el({
        content: [BB.el({ textContent: label }), input],
        css: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    });
}
