import { KlCanvas } from '../../canvas/kl-canvas';
import { Easel } from './easel';
import { BB } from '../../../bb/bb';
import { changeCanvasDimensions } from '../../../bb/base/change-canvas-dimensions';
import { throwIfNull } from '../../../bb/base/base';

export type TEaselProjectUpdaterParams<T extends string> = {
    klCanvas: KlCanvas;
    easel: Easel<T>;
    getRenderOverlays?: () => { image: CanvasImageSource; opacity: number }[];
};

/**
 * Allows KlCanvas to be rendered by Easel.
 * Call update when KlCanvas changed (added layer, moved layer, removed layer, changed selection, redo/undo)
 */
export class EaselProjectUpdater<T extends string> {
    private readonly klCanvas: KlCanvas;
    private readonly easel: Easel<T>;
    private readonly getRenderOverlays: NonNullable<TEaselProjectUpdaterParams<T>['getRenderOverlays']>;
    private compositeCanvas: HTMLCanvasElement | undefined;

    // ----------------------------------- public -----------------------------------
    constructor(p: TEaselProjectUpdaterParams<T>) {
        this.klCanvas = p.klCanvas;
        this.easel = p.easel;
        this.getRenderOverlays = p.getRenderOverlays ?? (() => []);
        this.update();
    }

    update(): void {
        const width = this.klCanvas.getWidth();
        const height = this.klCanvas.getHeight();
        const layers = this.klCanvas.getLayers();

        // free resources if no compositing being done
        if (layers.some((layer) => layer.compositeObj)) {
            if (!this.compositeCanvas) {
                this.compositeCanvas = BB.canvas(width, height);
            }
        } else {
            if (this.compositeCanvas) {
                BB.freeCanvas(this.compositeCanvas);
                this.compositeCanvas = undefined;
            }
        }
        const compositeCanvas = this.compositeCanvas;
        this.easel.setProject({
            width,
            height,
            layers: layers.map((layer) => {
                return {
                    image:
                        layer.compositeObj && compositeCanvas
                            ? () => {
                                  changeCanvasDimensions(compositeCanvas, width, height, {
                                      ensureCleared: true,
                                  });
                                  const ctx = compositeCanvas.getContext('2d')!;
                                  ctx.drawImage(layer.canvas, 0, 0);
                                  layer.compositeObj?.draw(
                                      throwIfNull(compositeCanvas.getContext('2d')),
                                  );
                                  return compositeCanvas;
                              }
                            : layer.canvas,
                    isVisible: layer.isVisible,
                    opacity: layer.opacity,
                    mixModeStr: layer.mixModeStr,
                    hasClipping: layer.hasClipping,
                };
            }),
            selection: this.klCanvas.getSelection(),
            renderOverlays: this.getRenderOverlays(),
        });
    }

    // if you're not rendering easel for a while
    freeCompositeCanvas(): void {
        if (this.compositeCanvas) {
            BB.freeCanvas(this.compositeCanvas);
            this.compositeCanvas = undefined;
        }
    }
}
