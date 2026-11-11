import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { TActiveFrameSet } from '../../frames/frame-set';
import * as classes from './frames-ui.module.scss';

export type TFramesUiParams = {
    onAdd: () => void | Promise<void>;
    onDuplicate: () => void | Promise<void>;
    onDelete: () => void | Promise<void>;
    onMoveLeft: () => void | Promise<void>;
    onMoveRight: () => void | Promise<void>;
    onSelect: (index: number) => void | Promise<void>;
};

export class FramesUi {
    private readonly rootEl: HTMLElement;
    private readonly params: TFramesUiParams;
    private isBusy = false;
    private state: TActiveFrameSet | undefined;
    private activeThumbnailEl: HTMLImageElement | HTMLSpanElement | undefined;

    private createButton(
        label: string,
        callback: () => void | Promise<void>,
        disabled = false,
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = classes.button;
        button.textContent = label;
        button.disabled = this.isBusy || disabled;
        button.addEventListener('click', () => {
            void callback();
        });
        return button;
    }

    private render(): void {
        this.rootEl.replaceChildren();
        this.activeThumbnailEl = undefined;
        if (!this.state) {
            BB.el({
                parent: this.rootEl,
                content: LANG('frames-empty'),
                className: classes.description,
            });
            BB.el({
                tagName: 'button',
                parent: this.rootEl,
                content: LANG('frames-add'),
                className: classes.button,
                props: { type: 'button', disabled: this.isBusy },
                onClick: () => {
                    void this.params.onAdd();
                },
            });
            return;
        }

        const { frameSet, activeFrameIndex } = this.state;
        const actions = BB.el({ parent: this.rootEl, className: classes.actions });
        actions.append(
            this.createButton(LANG('frames-add'), this.params.onAdd),
            this.createButton(LANG('frames-duplicate'), this.params.onDuplicate),
            this.createButton(
                LANG('frames-delete'),
                this.params.onDelete,
                frameSet.frames.length === 1,
            ),
            this.createButton(
                LANG('frames-left'),
                this.params.onMoveLeft,
                activeFrameIndex === 0,
            ),
            this.createButton(
                LANG('frames-right'),
                this.params.onMoveRight,
                activeFrameIndex === frameSet.frames.length - 1,
            ),
        );

        const list = BB.el({ parent: this.rootEl, className: classes.frameList });
        frameSet.frames.forEach((frame, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className =
                index === activeFrameIndex
                    ? `${classes.frame} ${classes.frameActive}`
                    : classes.frame;
            button.title = `${LANG('frames-frame')} ${index + 1}`;
            button.disabled = this.isBusy;
            button.addEventListener('click', () => {
                void this.params.onSelect(index);
            });
            if (frame.thumbnail) {
                const image = document.createElement('img');
                image.className = classes.thumbnail;
                image.src = frame.thumbnail;
                image.alt = '';
                button.append(image);
                if (index === activeFrameIndex) {
                    this.activeThumbnailEl = image;
                }
            } else {
                const emptyThumbnail = document.createElement('span');
                emptyThumbnail.className = classes.thumbnail;
                button.append(emptyThumbnail);
                if (index === activeFrameIndex) {
                    this.activeThumbnailEl = emptyThumbnail;
                }
            }
            const number = document.createElement('span');
            number.className = classes.frameNumber;
            number.textContent = `${index + 1}`;
            button.append(number);
            list.append(button);
        });
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

    update(state: TActiveFrameSet | undefined): void {
        this.state = state;
        this.render();
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
