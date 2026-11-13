import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { TFrameSet } from '../../frames/frame-set';
import { showModal } from './base/show-modal';

export type TCopyFrameLayersDialogResult = {
    layerIds: string[];
    targetIndexes: number[];
    mode: 'replace' | 'add';
};

export function showCopyFrameLayersDialog(
    frameSet: TFrameSet,
    activeFrameIndex: number,
    onConfirm: (result: TCopyFrameLayersDialogResult) => void,
): void {
    const source = frameSet.frames[activeFrameIndex];
    if (!source) return;
    const content = BB.el({ css: { width: 400, maxWidth: '85vw', maxHeight: '70vh', overflowY: 'auto' } });
    const checkedLayers = new Set<string>();
    const targets = new Set<number>();
    let mode: 'replace' | 'add' = 'replace';
    const copyButton = () => {
        const modal = document.querySelector('.kl-popup');
        return modal && Array.from(modal.querySelectorAll<HTMLButtonElement>('.kl-popup__btn'))
            .find((button) => button.querySelector('.kl-popup__btn__text')?.textContent === 'Copy');
    };
    const syncCopyButton = () => {
        const button = copyButton();
        if (button) button.disabled = checkedLayers.size === 0 || targets.size === 0;
    };
    const heading = (text: string) => BB.el({ parent: content, textContent: text, css: { fontWeight: 'bold', margin: '8px 0 4px' } });

    heading(LANG('frames-copy-layers-layers'));
    const layerList = BB.el({ parent: content, css: { display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 130, overflowY: 'auto' } });
    source.layers.map((layer, index) => ({ layer, index })).reverse().forEach(({ layer, index }) => {
        if (layer.role === 'frame-base') return;
        const checkbox = BB.el({ tagName: 'input', props: { type: 'checkbox', checked: true } }) as HTMLInputElement;
        checkedLayers.add(layer.id);
        checkbox.addEventListener('change', () => {
            checkbox.checked ? checkedLayers.add(layer.id) : checkedLayers.delete(layer.id);
            syncCopyButton();
        });
        BB.el({
            parent: layerList,
            tagName: 'label',
            content: [checkbox, BB.el({ textContent: layer.name ?? `${LANG('layers-layer')} ${index + 1}` })],
            css: { display: 'flex', alignItems: 'center', gap: 7, minHeight: 22 },
        });
    });

    heading(LANG('frames-copy-layers-targets'));
    const targetGrid = BB.el({ parent: content, css: { display: 'flex', flexWrap: 'wrap', gap: 5 } });
    frameSet.frames.forEach((frame, index) => {
        const isActive = index === activeFrameIndex;
        const button = BB.el({
            parent: targetGrid,
            tagName: 'button',
            className: 'kl-button',
            props: { type: 'button', title: `${LANG('frames-frame')} ${index + 1}`, disabled: isActive },
            css: {
                position: 'relative', display: 'block', boxSizing: 'border-box', flex: '0 0 40px',
                width: 40, height: 40, padding: 0, overflow: 'hidden', border: '1px solid #bbb',
                borderRadius: 3, background: 'var(--kl-checkerboard-background)', opacity: isActive ? 0.4 : 1,
            },
        }) as HTMLButtonElement;
        button.setAttribute('aria-label', `${LANG('frames-frame')} ${index + 1}`);
        button.setAttribute('aria-pressed', 'false');
        if (frame.thumbnail) {
            button.append(BB.el({ tagName: 'img', props: { src: frame.thumbnail, alt: '' }, css: { width: '100%', height: '100%', objectFit: 'contain' } }));
        }
        BB.el({ parent: button, textContent: String(index + 1), css: { position: 'absolute', right: 2, bottom: 1, color: '#fff', fontSize: 10, lineHeight: '11px', textShadow: '1px 1px #222', pointerEvents: 'none' } });
        button.addEventListener('click', () => {
            if (isActive) return;
            if (targets.has(index)) targets.delete(index);
            else targets.add(index);
            button.setAttribute('aria-pressed', String(targets.has(index)));
            button.style.boxShadow = targets.has(index) ? '0 0 0 2px #3b82f6' : '';
            syncCopyButton();
        });
    });
    const targetActions = BB.el({ parent: content, css: { display: 'flex', gap: 5, marginTop: 5 } });
    const allButton = BB.el({ parent: targetActions, tagName: 'button', className: 'kl-button', textContent: LANG('frames-copy-layers-all') });
    const noneButton = BB.el({ parent: targetActions, tagName: 'button', className: 'kl-button', textContent: LANG('frames-copy-layers-none') });
    allButton.addEventListener('click', () => {
        targets.clear();
        frameSet.frames.forEach((_, index) => { if (index !== activeFrameIndex) targets.add(index); });
        targetGrid.querySelectorAll<HTMLButtonElement>('button').forEach((button, index) => {
            const selected = targets.has(index);
            button.setAttribute('aria-pressed', String(selected));
            button.style.boxShadow = selected ? '0 0 0 2px #3b82f6' : '';
        });
        syncCopyButton();
    });
    noneButton.addEventListener('click', () => {
        targets.clear();
        targetGrid.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
            button.setAttribute('aria-pressed', 'false');
            button.style.boxShadow = '';
        });
        syncCopyButton();
    });

    heading(LANG('frames-copy-layers-mode'));
    const radioGroup = BB.el({ parent: content, css: { display: 'flex', flexDirection: 'column', gap: 3 } });
    const addMode = (value: 'replace' | 'add', label: string) => {
        const input = BB.el({ tagName: 'input', props: { type: 'radio', name: 'copy-frame-layer-mode', checked: value === mode } }) as HTMLInputElement;
        input.addEventListener('change', () => { if (input.checked) mode = value; });
        BB.el({ parent: radioGroup, tagName: 'label', content: [input, label], css: { display: 'flex', alignItems: 'center', gap: 7, minHeight: 22 } });
    };
    addMode('replace', LANG('frames-copy-layers-replace'));
    addMode('add', LANG('frames-copy-layers-add'));

    const modal = showModal({
        message: LANG('frames-copy-layers-title'),
        div: content,
        buttons: [{ id: 'copy', label: 'Copy' }, 'Cancel'],
        primaries: ['copy'],
        clickOnEnter: 'copy',
        autoFocus: false,
        callback: (result) => {
            if (result === 'copy' && checkedLayers.size && targets.size) {
                onConfirm({ layerIds: [...checkedLayers], targetIndexes: [...targets], mode });
            }
        },
    });
    void modal;
    syncCopyButton();
}
