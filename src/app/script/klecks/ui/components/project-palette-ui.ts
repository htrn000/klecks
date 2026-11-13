import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { getIconSvg } from '../../../icon/icon';
import { saveAs } from '../../../bb/base/save-as';
import { showModal } from '../modals/base/show-modal';
import * as classes from './project-palette-ui.module.scss';
import {
    addPaletteColor,
    movePaletteColor,
    normalizePalette,
    parseGplPalette,
    parseHexPalette,
    removePaletteColor,
    serializeGplPalette,
    serializeHexPalette,
    TPaletteColor,
    TProjectPaletteData,
} from '../../palette/palette-model';

/** Project-owned color swatches and their edit dialog. */
export class ProjectPaletteUi {
    private readonly root: HTMLElement;
    private readonly swatches: HTMLElement;
    private readonly onChange: (palette: TProjectPaletteData) => void;
    private readonly onSetPrimary: (color: TPaletteColor) => void;
    private readonly getPrimary: () => TPaletteColor;
    private readonly onExtract: () => TProjectPaletteData;
    private palette: TProjectPaletteData = { colors: [] };
    private primaryColor: TPaletteColor = { r: 0, g: 0, b: 0 };

    constructor(p: {
        onChange: (palette: TProjectPaletteData) => void;
        onSetPrimary: (color: TPaletteColor) => void;
        getPrimary: () => TPaletteColor;
        onExtract: () => TProjectPaletteData;
    }) {
        this.onChange = p.onChange;
        this.onSetPrimary = p.onSetPrimary;
        this.getPrimary = p.getPrimary;
        this.onExtract = p.onExtract;
        this.root = BB.el({ className: classes.root });

        const header = BB.el({ className: classes.header });
        const title = BB.el({ tagName: 'div', content: LANG('palette-title'), className: classes.title });
        const spacer = BB.el({ className: classes.spacer });
        const edit = BB.el({
            tagName: 'button', className: `kl-button ${classes.editButton}`,
            props: { type: 'button', title: LANG('palette-edit') },
            content: getIconSvg('edit-pencil', { height: 14 }),
        }) as HTMLButtonElement;
        edit.setAttribute('aria-label', LANG('palette-edit'));
        edit.addEventListener('click', () => this.openEditor());
        header.append(title, spacer, edit);

        this.swatches = BB.el({ className: classes.mainGrid });
        this.root.append(header, this.swatches);
        this.renderMain();
    }

    getElement(): HTMLElement { return this.root; }

    setPalette(palette: unknown): void {
        this.palette = normalizePalette(palette);
        this.renderMain();
    }

    setCurrentPrimaryColor(color: TPaletteColor): void {
        this.primaryColor = { ...color };
        this.renderMain();
    }

    private update(palette: TProjectPaletteData): void {
        this.palette = normalizePalette(palette);
        this.onChange(this.palette);
        this.renderMain();
    }

    private colorHex(color: TPaletteColor): string {
        return `#${[color.r, color.g, color.b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    }

    private sameColor(a: TPaletteColor, b: TPaletteColor): boolean {
        return a.r === b.r && a.g === b.g && a.b === b.b;
    }

    private addCurrentColor(): void {
        if (this.palette.colors.length >= 64) return;
        this.update(addPaletteColor(this.palette, this.getPrimary()));
    }

    private makeSwatch(color: TPaletteColor, size: 'main' | 'dialog', selected: boolean, onClick: () => void): HTMLButtonElement {
        const hex = this.colorHex(color);
        const swatch = BB.el({
            tagName: 'button',
            className: `${classes.swatch} ${size === 'main' ? classes.mainSwatch : classes.dialogSwatch}${selected ? ` ${classes.selected}` : ''}`,
            props: { type: 'button', title: hex },
            css: { backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` },
        }) as HTMLButtonElement;
        swatch.setAttribute('aria-label', hex);
        swatch.addEventListener('click', onClick);
        return swatch;
    }

    private makeAddCell(size: 'main' | 'dialog', onAdd?: () => void): HTMLButtonElement {
        const atLimit = this.palette.colors.length >= 64;
        const button = BB.el({
            tagName: 'button',
            className: `${classes.addCell} ${size === 'main' ? classes.mainAdd : classes.dialogAdd}`,
            props: {
                type: 'button',
                title: atLimit ? LANG('palette-full-tooltip') : LANG('palette-add-tooltip'),
                disabled: atLimit,
            },
            content: getIconSvg('add-layer', { width: 14, height: 14 }),
        }) as HTMLButtonElement;
        button.setAttribute('aria-label', LANG('palette-add-tooltip'));
        button.addEventListener('click', onAdd || (() => this.addCurrentColor()));
        return button;
    }

    private renderMain(): void {
        this.primaryColor = this.getPrimary();
        this.swatches.replaceChildren();
        for (const color of this.palette.colors) {
            this.swatches.append(this.makeSwatch(color, 'main', this.sameColor(color, this.primaryColor), () => this.onSetPrimary(color)));
        }
        this.swatches.append(this.makeAddCell('main'));
    }

    private openEditor(): void {
        let selectedIndex: number | undefined;
        const editor = BB.el({ className: classes.editor });
        const grid = BB.el({ className: classes.dialogGrid });
        const toolbar = BB.el({ className: classes.toolbar });
        const hex = BB.el({ className: classes.selectedHex });
        const actions = BB.el({ className: classes.actions });
        const fileInput = BB.el({
            tagName: 'input',
            props: { type: 'file', accept: '.gpl,.hex,text/plain' },
            className: classes.hiddenInput,
        }) as HTMLInputElement;

        const moveLeft = this.iconButton('frame-move-left', LANG('palette-move-left'), () => move(-1));
        const moveRight = this.iconButton('frame-move-right', LANG('palette-move-right'), () => move(1));
        const remove = this.iconButton('remove-layer', LANG('palette-remove'), () => {
            if (selectedIndex === undefined) return;
            this.update(removePaletteColor(this.palette, selectedIndex));
            selectedIndex = undefined;
            render();
        });

        const render = () => {
            grid.replaceChildren();
            this.palette.colors.forEach((color, index) => {
                grid.append(this.makeSwatch(color, 'dialog', selectedIndex === index, () => {
                    selectedIndex = index;
                    render();
                }));
            });
            grid.append(this.makeAddCell('dialog', () => {
                const before = this.palette.colors.length;
                this.addCurrentColor();
                if (this.palette.colors.length > before) render();
            }));
            const selected = selectedIndex === undefined ? undefined : this.palette.colors[selectedIndex];
            hex.textContent = selected ? this.colorHex(selected) : '';
            moveLeft.disabled = moveRight.disabled = remove.disabled = selectedIndex === undefined;
        };

        const move = (delta: number) => {
            if (selectedIndex === undefined) return;
            const to = Math.max(0, Math.min(this.palette.colors.length - 1, selectedIndex + delta));
            if (to === selectedIndex) return;
            this.update(movePaletteColor(this.palette, selectedIndex, to));
            selectedIndex = to;
            render();
        };

        const renderEditor = render;

        const toolbarContent = [moveLeft, moveRight, remove, hex];
        toolbar.append(...toolbarContent);

        const separator = BB.el({ className: classes.separator });
        const extract = this.actionButton(LANG('palette-extract'), () => {
            this.update(this.onExtract());
            selectedIndex = undefined;
            renderEditor();
        });
        const importButton = this.actionButton(LANG('palette-import'), () => fileInput.click());
        const exportHex = this.actionButton(LANG('palette-export-hex'), () => this.export('palette.hex', serializeHexPalette(this.palette)));
        const exportGpl = this.actionButton(LANG('palette-export-gpl'), () => this.export('palette.gpl', serializeGplPalette(this.palette)));
        const clear = this.actionButton(LANG('palette-clear'), () => {
            showModal({
                message: LANG('palette-clear-confirm'),
                buttons: ['Ok', 'Cancel'],
                deleteButton: 'Ok',
                callback: (result) => {
                    if (result === 'Ok') {
                        this.update({ colors: [] });
                        selectedIndex = undefined;
                        renderEditor();
                    }
                },
            });
        });
        clear.classList.add(classes.clearButton);
        clear.style.color = '#b00020';
        actions.append(extract, importButton, exportHex, exportGpl, clear);
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const parsed = file.name.toLowerCase().endsWith('.gpl')
                ? parseGplPalette(await file.text())
                : parseHexPalette(await file.text());
            const replace = () => {
                this.update(parsed);
                selectedIndex = undefined;
                renderEditor();
            };
            if (this.palette.colors.length) {
                showModal({
                    message: LANG('palette-import-confirm'),
                    buttons: ['Ok', 'Cancel'],
                    callback: (result) => { if (result === 'Ok') replace(); },
                });
            } else replace();
            fileInput.value = '';
        });
        editor.append(grid, toolbar, separator, actions, fileInput);
        renderEditor();
        showModal({
            message: `<b>${LANG('palette-edit')}</b>`,
            div: editor,
            buttons: [{ id: 'done', label: LANG('palette-done') }],
            primaries: ['done'],
        });
    }

    private iconButton(icon: 'frame-move-left' | 'frame-move-right' | 'remove-layer', title: string, onClick: () => void): HTMLButtonElement {
        const button = BB.el({
            tagName: 'button', className: `kl-button ${classes.toolbarButton}`,
            props: { type: 'button', title },
            content: getIconSvg(icon, { height: 18 }),
        }) as HTMLButtonElement;
        button.setAttribute('aria-label', title);
        button.addEventListener('click', onClick);
        return button;
    }

    private actionButton(label: string, onClick: () => void): HTMLButtonElement {
        const button = BB.el({ tagName: 'button', content: label, className: `kl-button ${classes.actionButton}`, props: { type: 'button' } }) as HTMLButtonElement;
        button.addEventListener('click', onClick);
        return button;
    }

    private async export(fileName: string, text: string): Promise<void> {
        await saveAs(fileName, 'text/plain', async () => new Blob([text], { type: 'text/plain;charset=utf-8' }), true);
    }
}
