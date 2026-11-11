import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import type { TGifExportOptions } from '../../frames/gif-export';
import { showModal } from './base/show-modal';

export type TGifExportRequest = TGifExportOptions & { from: number; to: number };

export function showGifExportDialog(frameCount: number, onExport: (request: TGifExportRequest) => void): void {
    const from = numberInput(1, 1, frameCount);
    const to = numberInput(frameCount, 1, frameCount);
    const fps = numberInput(12, 1, 100);
    const scale = BB.el({ tagName: 'select', className: 'kl-input' }) as HTMLSelectElement;
    for (const value of [1, 2, 4] as const) {
        const option = BB.el({ tagName: 'option', content: `${value}×` }) as HTMLOptionElement;
        option.value = String(value);
        scale.append(option);
    }
    const loop = BB.el({ tagName: 'select', className: 'kl-input' }) as HTMLSelectElement;
    for (const [value, label] of [['forever', LANG('gif-loop-forever')], ['once', LANG('gif-loop-once')]] as const) {
        const option = BB.el({ tagName: 'option', content: label }) as HTMLOptionElement;
        option.value = value;
        loop.append(option);
    }
    const transparency = BB.el({ tagName: 'input', props: { type: 'checkbox', checked: true } }) as HTMLInputElement;
    const content = BB.el({
        content: [
            row(LANG('gif-frame-range'), from, to),
            row(LANG('gif-fps'), fps),
            row(LANG('gif-loop'), loop),
            row(LANG('gif-transparency'), transparency),
            row(LANG('gif-scale'), scale),
        ],
        css: { display: 'grid', gap: 8, minWidth: 320 },
    });
    showModal({
        message: `<b>${LANG('gif-export-title')}</b>`,
        div: content,
        buttons: [{ id: 'export', label: LANG('gif-export-action') }, 'Cancel'],
        primaries: ['export'],
        callback: (result) => {
            if (result !== 'export') return;
            const first = Number(from.value);
            const last = Number(to.value);
            const frameRate = Number(fps.value);
            if (
                !Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > frameCount ||
                !Number.isFinite(frameRate) || frameRate <= 0 || frameRate > 100
            ) {
                alert(LANG('gif-invalid-options'));
                return;
            }
            onExport({
                from: first,
                to: last,
                fps: frameRate,
                loop: loop.value === 'once' ? 'once' : 'forever',
                transparency: transparency.checked,
                scale: Number(scale.value) as 1 | 2 | 4,
                background: { r: 255, g: 255, b: 255 },
            });
        },
    });
}

export function showGifProgressDialog(): {
    update(progress: number): void;
    close(): void;
    isCancelled(): boolean;
} {
    const label = BB.el({ textContent: LANG('gif-progress-preparing'), css: { marginBottom: 8 } });
    const progress = BB.el({ tagName: 'progress', props: { max: 100, value: 0 }, css: { width: 260 } }) as HTMLProgressElement;
    let closeDialog: (() => void) | undefined;
    let cancelled = false;
    let complete = false;
    showModal({
        message: `<b>${LANG('gif-progress-title')}</b>`,
        div: BB.el({ content: [label, progress] }),
        buttons: [{ id: 'cancel', label: LANG('modal-cancel') }],
        callback: (result) => { if (result === 'cancel' && !complete) cancelled = true; },
        closeFunc: (close) => { closeDialog = close; },
    });
    return {
        update(value) {
            const percentage = Math.max(0, Math.min(100, Math.round(value * 100)));
            progress.value = percentage;
            label.textContent = `${LANG('gif-progress-encoding')} ${percentage}%`;
        },
        close() {
            complete = true;
            closeDialog?.();
        },
        isCancelled: () => cancelled,
    };
}

function numberInput(value: number, min: number, max: number): HTMLInputElement {
    const input = BB.el({ tagName: 'input', className: 'kl-input' }) as HTMLInputElement;
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(value);
    return input;
}

function row(label: string, ...controls: HTMLElement[]): HTMLElement {
    return BB.el({
        content: [BB.el({ content: label }), ...controls],
        css: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, alignItems: 'center' },
    });
}
