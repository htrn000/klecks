import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { getIconSvg } from '../../../icon/icon';
import { BoxToggle } from '../components/box-toggle';
import { TActiveFrameSet } from '../../frames/frame-set';
import { IconName } from '../../../../icons/icons';
import * as classes from './frames-ui.module.scss';

export type TFramesUiParams = {
    onAdd: () => void | Promise<void>;
    onDuplicate: () => void | Promise<void>;
    onDelete: () => void | Promise<void>;
    onMoveLeft: () => void | Promise<void>;
    onMoveRight: () => void | Promise<void>;
    onSelect: (index: number) => void | Promise<void>;
    onSetReference: () => void | Promise<void>;
    onToggleOriginal: (show: boolean) => void;
    onToggleOnion: (show: boolean) => void;
    onOpacityChange: (opacity: number) => void;
    onCopyOriginal: () => void | Promise<void>;
    onCopySelection: () => void | Promise<void>;
};

export type TFramesReferenceUiState = {
    hasReference: boolean;
    canShowOnion: boolean;
    showOriginal: boolean;
    showOnion: boolean;
    opacity: number;
    hasSelection: boolean;
};

export class FramesUi {
    private readonly rootEl: HTMLElement;
    private readonly params: TFramesUiParams;
    private isBusy = false;
    private state: TActiveFrameSet | undefined;
    private activeThumbnailEl: HTMLImageElement | HTMLSpanElement | undefined;
    private referenceUiState: TFramesReferenceUiState = {
        hasReference: false,
        canShowOnion: false,
        showOriginal: false,
        showOnion: false,
        opacity: 0.35,
        hasSelection: false,
    };
    private copySelectionButton: HTMLButtonElement | undefined;

    private iconButton(icon: IconName, title: string, callback: () => void | Promise<void>, disabled = false): HTMLButtonElement {
        const button = BB.el({
            tagName: 'button',
            className: `kl-button ${classes.iconButton}`,
            props: { type: 'button', title, disabled: this.isBusy || disabled },
            content: getIconSvg(icon, { height: 20 }),
        }) as HTMLButtonElement;
        button.setAttribute('aria-label', title);
        button.addEventListener('click', () => { void callback(); });
        return button;
    }

    private createToggle(
        icon: IconName,
        title: string,
        initial: boolean,
        unavailable: boolean,
        callback: (show: boolean) => void,
    ): BoxToggle {
        let toggle: BoxToggle;
        toggle = new BoxToggle({
            label: getIconSvg(icon, { height: 20 }),
            title,
            init: initial,
            onChange: (value) => {
                if (unavailable || this.isBusy) {
                    toggle.setValue(initial);
                    toggle.getElement().setAttribute('aria-pressed', String(initial));
                    return;
                }
                toggle.getElement().setAttribute('aria-pressed', String(value));
                callback(value);
            },
        });
        const element = toggle.getElement();
        element.classList.add(classes.iconToggle);
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', title);
        element.setAttribute('aria-pressed', String(initial));
        if (unavailable || this.isBusy) {
            element.classList.add(classes.toggleDisabled);
            element.setAttribute('aria-disabled', 'true');
        }
        return toggle;
    }

    private divider(): HTMLElement {
        const divider = BB.el({ className: classes.divider });
        divider.setAttribute('aria-hidden', 'true');
        return divider;
    }

    private render(): void {
        this.rootEl.replaceChildren();
        this.activeThumbnailEl = undefined;
        this.copySelectionButton = undefined;
        if (!this.state) {
            BB.el({
                tagName: 'p',
                parent: this.rootEl,
                content: LANG('frames-empty'),
                className: classes.description,
            });
            const addButton = BB.el({
                tagName: 'button',
                parent: this.rootEl,
                className: `kl-button ${classes.emptyAddButton}`,
                props: { type: 'button', title: LANG('frames-add'), disabled: this.isBusy },
                content: [getIconSvg('frame-add', { height: 18 }), LANG('frames-add')],
                onClick: () => { void this.params.onAdd(); },
            }) as HTMLButtonElement;
            addButton.setAttribute('aria-label', LANG('frames-add'));
            return;
        }

        const { frameSet, activeFrameIndex } = this.state;

        // The frame strip precedes both toolbars so the thumbnails remain the panel's first row.
        const list = BB.el({ parent: this.rootEl, className: classes.frameList });
        frameSet.frames.forEach((frame, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = index === activeFrameIndex
                ? `${classes.frame} ${classes.frameActive}`
                : classes.frame;
            button.title = `${LANG('frames-frame')} ${index + 1}`;
            button.disabled = this.isBusy;
            button.addEventListener('click', () => { void this.params.onSelect(index); });
            if (frame.thumbnail) {
                const image = document.createElement('img');
                image.className = classes.thumbnail;
                image.src = frame.thumbnail;
                image.alt = '';
                button.append(image);
                if (index === activeFrameIndex) this.activeThumbnailEl = image;
            } else {
                const emptyThumbnail = document.createElement('span');
                emptyThumbnail.className = classes.thumbnail;
                button.append(emptyThumbnail);
                if (index === activeFrameIndex) this.activeThumbnailEl = emptyThumbnail;
            }
            const number = document.createElement('span');
            number.className = classes.frameNumber;
            number.textContent = `${index + 1}`;
            button.append(number);
            list.append(button);
        });

        const actions = BB.el({ parent: this.rootEl, className: classes.actionRow });
        actions.append(
            this.iconButton('frame-add', LANG('frames-add'), this.params.onAdd),
            this.iconButton('duplicate-layer', LANG('frames-duplicate'), this.params.onDuplicate),
            this.iconButton('remove-layer', LANG('frames-delete'), this.params.onDelete, frameSet.frames.length === 1),
            this.divider(),
            this.iconButton('frame-move-left', LANG('frames-move-left'), this.params.onMoveLeft, activeFrameIndex === 0),
            this.iconButton('frame-move-right', LANG('frames-move-right'), this.params.onMoveRight, activeFrameIndex === frameSet.frames.length - 1),
        );

        const reference = BB.el({ parent: this.rootEl, className: classes.referenceRow });
        const showOriginal = this.createToggle(
            'frame-show-original', LANG('frames-show-original'), this.referenceUiState.showOriginal,
            !this.referenceUiState.hasReference,
            (show) => this.params.onToggleOriginal(show),
        );
        const showOnion = this.createToggle(
            'frame-onion', LANG('frames-onion-skin'), this.referenceUiState.showOnion,
            !this.referenceUiState.canShowOnion,
            (show) => this.params.onToggleOnion(show),
        );
        const selectionButton = this.iconButton(
            'frame-copy-selection', LANG('frames-copy-reference-selection'), this.params.onCopySelection,
            !this.referenceUiState.hasReference || !this.referenceUiState.hasSelection,
        );
        this.copySelectionButton = selectionButton;
        reference.append(
            this.iconButton('frame-reference', LANG('frames-set-reference'), this.params.onSetReference),
            this.iconButton('frame-copy-original', LANG('frames-copy-reference'), this.params.onCopyOriginal, !this.referenceUiState.hasReference),
            selectionButton,
            this.divider(),
            showOriginal.getElement(),
            showOnion.getElement(),
        );

        if (this.referenceUiState.showOriginal || this.referenceUiState.showOnion) {
            const opacityRow = BB.el({ parent: this.rootEl, className: classes.opacityRow });
            const opacity = document.createElement('input');
            opacity.type = 'range';
            opacity.min = '0';
            opacity.max = '100';
            opacity.value = String(Math.round(this.referenceUiState.opacity * 100));
            opacity.title = LANG('frames-overlay-opacity');
            opacity.setAttribute('aria-label', LANG('frames-overlay-opacity'));
            opacity.disabled = this.isBusy;
            opacity.className = classes.opacitySlider;
            const value = BB.el({ tagName: 'span', content: `${opacity.value}%`, className: classes.opacityValue });
            opacity.addEventListener('input', () => {
                value.textContent = `${opacity.value}%`;
                this.params.onOpacityChange(Number(opacity.value) / 100);
            });
            opacityRow.append(opacity, value);
        }
    }

    constructor(params: TFramesUiParams) {
        this.params = params;
        this.rootEl = BB.el({ className: classes.root });
        this.render();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsVisible(visible: boolean): void {
        this.rootEl.style.display = visible ? '' : 'none';
    }

    setBusy(busy: boolean): void {
        this.isBusy = busy;
        this.render();
    }

    update(state: TActiveFrameSet | undefined, referenceUiState?: TFramesReferenceUiState): void {
        this.state = state;
        if (referenceUiState) this.referenceUiState = referenceUiState;
        this.render();
    }

    updateSelectionAvailability(hasSelection: boolean): void {
        this.referenceUiState.hasSelection = hasSelection;
        if (this.copySelectionButton) {
            this.copySelectionButton.disabled =
                this.isBusy || !this.referenceUiState.hasReference || !hasSelection;
        }
    }

    updateActiveThumbnail(thumbnail: string): void {
        if (!this.state) return;
        const frame = this.state.frameSet.frames[this.state.activeFrameIndex];
        if (!frame || frame.thumbnail === thumbnail) return;
        frame.thumbnail = thumbnail;
        if (this.activeThumbnailEl instanceof HTMLImageElement) {
            this.activeThumbnailEl.src = thumbnail;
        } else if (this.activeThumbnailEl) {
            const image = document.createElement('img');
            image.className = classes.thumbnail;
            image.src = thumbnail;
            image.alt = '';
            this.activeThumbnailEl.replaceWith(image);
            this.activeThumbnailEl = image;
        }
    }
}
