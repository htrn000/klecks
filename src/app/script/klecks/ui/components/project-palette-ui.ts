import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { saveAs } from '../../../bb/base/save-as';
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

/** Compact project-owned palette controls placed beside the color picker. */
export class ProjectPaletteUi {
    private readonly root: HTMLElement;
    private readonly swatches: HTMLElement;
    private readonly onChange: (palette: TProjectPaletteData) => void;
    private readonly onSetPrimary: (color: TPaletteColor) => void;
    private readonly getPrimary: () => TPaletteColor;
    private palette: TProjectPaletteData = { colors: [] };

    constructor(p: {
        onChange: (palette: TProjectPaletteData) => void;
        onSetPrimary: (color: TPaletteColor) => void;
        getPrimary: () => TPaletteColor;
        onExtract: () => TProjectPaletteData;
    }) {
        this.onChange = p.onChange;
        this.onSetPrimary = p.onSetPrimary;
        this.getPrimary = p.getPrimary;
        this.root = BB.el({ css: { width: '100%', marginTop: 8, fontSize: 12 } });
        const title = BB.el({ tagName: 'div', content: LANG('palette-title'), css: { fontWeight: 'bold', marginBottom: 4 } });
        this.swatches = BB.el({ css: { display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' } });
        const add = this.action(LANG('palette-add-current'), () => this.update(addPaletteColor(this.palette, this.getPrimary())));
        const extract = this.action(LANG('palette-extract'), () => this.update(p.onExtract()));
        const importInput = BB.el({ tagName: 'input', props: { type: 'file', accept: '.gpl,.hex,text/plain' }, css: { display: 'none' } }) as HTMLInputElement;
        importInput.addEventListener('change', async () => {
            const file = importInput.files?.[0];
            if (!file) return;
            const text = await file.text();
            this.update(file.name.toLowerCase().endsWith('.gpl') ? parseGplPalette(text) : parseHexPalette(text));
            importInput.value = '';
        });
        const importButton = this.action(LANG('palette-import'), () => importInput.click());
        const exportHex = this.action(LANG('palette-export-hex'), () => this.export('palette.hex', serializeHexPalette(this.palette)));
        const exportGpl = this.action(LANG('palette-export-gpl'), () => this.export('palette.gpl', serializeGplPalette(this.palette)));
        this.root.append(title, this.swatches, add, extract, importButton, exportHex, exportGpl, importInput);
        this.render();
    }

    getElement(): HTMLElement { return this.root; }

    setPalette(palette: unknown): void {
        this.palette = normalizePalette(palette);
        this.render();
    }

    private update(palette: TProjectPaletteData): void {
        this.palette = normalizePalette(palette);
        this.onChange(this.palette);
        this.render();
    }

    private action(label: string, onClick: () => void): HTMLButtonElement {
        const button = BB.el({ tagName: 'button', content: label, css: { margin: '3px 3px 0 0', cursor: 'pointer' } }) as HTMLButtonElement;
        button.addEventListener('click', onClick);
        return button;
    }

    private render(): void {
        this.swatches.replaceChildren();
        this.palette.colors.forEach((color, index) => {
            const group = BB.el({ css: { display: 'inline-flex', alignItems: 'center', border: '1px solid #888' } });
            const swatch = BB.el({ tagName: 'button', props: { title: `#${[color.r, color.g, color.b].map((v) => v.toString(16).padStart(2, '0')).join('')}` }, css: {
                width: 24, height: 24, border: 0, cursor: 'pointer',
                backgroundColor: `rgb(${color.r},${color.g},${color.b})`,
            } }) as HTMLButtonElement;
            swatch.addEventListener('click', () => this.onSetPrimary(color));
            const remove = this.smallButton('×', LANG('palette-remove'), () => this.update(removePaletteColor(this.palette, index)));
            const up = this.smallButton('↑', LANG('palette-move-up'), () => this.update(movePaletteColor(this.palette, index, index - 1)));
            const down = this.smallButton('↓', LANG('palette-move-down'), () => this.update(movePaletteColor(this.palette, index, index + 1)));
            up.disabled = index === 0;
            down.disabled = index === this.palette.colors.length - 1;
            group.append(swatch, up, down, remove);
            this.swatches.append(group);
        });
    }

    private smallButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
        const button = BB.el({ tagName: 'button', content: label, props: { title }, css: { padding: '2px 4px', cursor: 'pointer' } }) as HTMLButtonElement;
        button.addEventListener('click', onClick);
        return button;
    }

    private async export(fileName: string, text: string): Promise<void> {
        await saveAs(fileName, 'text/plain', async () => new Blob([text], { type: 'text/plain;charset=utf-8' }), true);
    }
}
