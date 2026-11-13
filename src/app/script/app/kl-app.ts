import { getIconUrl } from '../icon/icon';
import { KL } from '../klecks/kl';
import { TBrushId } from '../klecks/brushes-ui/brushes-ui';
import { BB } from '../bb/bb';
import { showIframeModal } from '../klecks/ui/modals/show-iframe-modal';
import { EmbedToolspaceTopRow } from '../embed/embed-toolspace-top-row';
import {
    TBrushUiInstance,
    TDeserializedKlStorageProject,
    TDrawEvent,
    TExportType,
    TGradient,
    TKlProject,
    TRgb,
    TMixMode,
    TUiLayout,
} from '../klecks/kl-types';
import { importFilters } from '../klecks/filters/filters-lazy';
import { klCanvasToPsdBlob } from '../klecks/storage/kl-canvas-to-psd-blob';
import { ProjectStore } from '../klecks/storage/project-store';
import { SaveReminder } from '../klecks/ui/components/save-reminder';
import { KlCanvas } from '../klecks/canvas/kl-canvas';
import { drawProject } from '../klecks/canvas/draw-project';
import { LANG } from '../language/language';
import { LocalStorage } from '../bb/base/local-storage';
import { LineSmoothing } from '../klecks/events/line-smoothing';
import { LineSanitizer } from '../klecks/events/line-sanitizer';
import { TabRow } from '../klecks/ui/components/tab-row';
import { LayerPreview } from '../klecks/ui/components/layer-preview';
import { KlColorSlider } from '../klecks/ui/components/kl-color-slider';
import { ToolspaceToolRow } from '../klecks/ui/components/toolspace-tool-row';
import { StatusOverlay } from '../klecks/ui/components/status-overlay';
import { SaveToComputer } from '../klecks/storage/save-to-computer';
import { translateSmoothing } from '../klecks/utils/translate-smoothing';
import { KlAppImportHandler } from './kl-app-import-handler';
import { LayersUi } from '../klecks/ui/tool-tabs/layers-ui/layers-ui';
import { FramesUi } from '../klecks/ui/tool-tabs/frames-ui';
import {
    addFrame,
    createFrameSet,
    deleteFrame,
    duplicateFrame,
    moveFrame,
    selectFrame,
    TActiveFrameSet,
    TFrame,
    TFrameSheetGeometry,
    TRnsPackageData,
} from '../klecks/frames/frame-set';
import { TCss, TVector2D } from '../bb/bb-types';
import { asyncThrow, css, getFilenameDate, randomUuid, sleep } from '../bb/base/base';
import { createConsoleApi } from './console-api';
import { KL_CONFIG } from '../klecks/kl-config';
import { TRenderTextParam } from '../klecks/image-operations/render-text';
import { Easel } from '../klecks/ui/easel/easel';
import { EaselHand } from '../klecks/ui/easel/tools/easel-hand';
import { EaselBrush } from '../klecks/ui/easel/tools/easel-brush';
import { EaselProjectUpdater } from '../klecks/ui/easel/easel-project-updater';
import { zoomByStep } from '../klecks/ui/project-viewport/utils/zoom-by-step';
import { EaselEyedropper } from '../klecks/ui/easel/tools/easel-eyedropper';
import { EaselPaintBucket } from '../klecks/ui/easel/tools/easel-paint-bucket';
import { EaselGradient } from '../klecks/ui/easel/tools/easel-gradient';
import { EaselText } from '../klecks/ui/easel/tools/easel-text';
import { EaselShape } from '../klecks/ui/easel/tools/easel-shape';
import { EaselRotate } from '../klecks/ui/easel/tools/easel-rotate';
import { EaselZoom } from '../klecks/ui/easel/tools/easel-zoom';
import { KlAppSelect } from './kl-app-select';
import { KlTempHistory } from '../klecks/history/kl-temp-history';
import { PinchZoomWatcher } from '../klecks/ui/components/pinch-zoom-watcher';
import { EASEL_MAX_SCALE, EASEL_MIN_SCALE } from '../klecks/ui/easel/easel.config';
import { THistoryEntryDataComposed } from '../klecks/history/history.types';
import { KlHistoryExecutor, THistoryExecutionType } from '../klecks/history/kl-history-executor';
import { KlHistory } from '../klecks/history/kl-history';
import { isHistoryEntryActiveLayerChange } from '../klecks/history/push-helpers/is-history-entry-active-layer-change';
import { MobileUi } from '../klecks/ui/mobile/mobile-ui';
import { MobileToolUi } from '../klecks/ui/mobile/mobile-tool-ui';
import { canvasToBlob } from '../bb/base/canvas';
import { loadImageFromBlob } from '../bb/base/load-image';
import { projectToComposed } from '../klecks/history/push-helpers/project-to-composed';
import { ERASE_COLOR } from '../klecks/brushes/erase-color';
import { KlRecoveryManager } from '../klecks/storage/kl-recovery-manager';
import { UnloadWarningTrigger } from '../klecks/ui/components/unload-warning-trigger';
import { KL_INDEXED_DB } from '../klecks/storage/kl-indexed-db';
import { showError, showModal } from '../klecks/ui/modals/base/show-modal';
import { runBrowserStorageBanner } from '../klecks/ui/components/browser-storage-banner';
import { requestPersistentStorage } from '../klecks/storage/request-persistent-storage';
import { CrossTabChannel } from '../bb/base/cross-tab-channel';
import { MobileColorUi } from '../klecks/ui/mobile/mobile-color-ui';
import { PixelBrush } from '../klecks/brushes/pixel-brush';
import { getSelectionPath2d } from '../bb/multi-polygon/get-selection-path-2d';
import { ToolspaceTopRow } from '../klecks/ui/components/toolspace-top-row';
import { setupUnfocusOnClickService } from '../klecks/ui/onfocus-on-click-service';
import { FloatingLayerPreview } from '../klecks/ui/components/floating-layer-preview';
import { showRnsSpriteGeometryDialog } from '../klecks/ui/modals/rns-sprite-geometry-dialog';
import { assembleRnsSpriteSheet, detectRnsSpriteGeometry, encodeRgbaPng, sliceRgbaSpriteSheet, scaleRgbaNearest } from '../klecks/frames/rns-sprite-sheet';
import { buildRnsImportedFrameSet } from '../klecks/frames/rns-frame-import';
import { applyRnsPackageEdits, listRnsAnimations, normalizeRnsFolderPath, readZipFile, rnsPackageNameFromPath, writeStoredZip, type TRnsPackageFiles } from '../klecks/frames/rns-package';
import { saveAs } from '../bb/base/save-as';
import { maxLayersFor } from '../klecks/canvas/layer-limits';
import { ProjectPaletteUi } from '../klecks/ui/components/project-palette-ui';
import { extractPaletteFromRgba, normalizePalette, TProjectPaletteData } from '../klecks/palette/palette-model';
import { selectGifFrameRange, TRgbaFrame } from '../klecks/frames/gif-export';
import { showGifExportDialog, showGifProgressDialog, TGifExportRequest } from '../klecks/ui/modals/gif-export-dialog';
import { RemoteProjectStore } from '../klecks/storage/remote-project-store';

const toolPaintImg = getIconUrl('tool-paint');
const toolHandImg = getIconUrl('tool-hand');
const toolFillImg = getIconUrl('tool-fill');
const toolGradientImg = getIconUrl('tool-gradient');
const toolTextImg = getIconUrl('tool-text');
const toolShapeImg = getIconUrl('tool-shape');
const toolSelectImg = getIconUrl('tool-select');
const tabSettingsImg = getIconUrl('tab-settings');
const tabLayersImg = getIconUrl('tab-layers');
const tabFramesImg = getIconUrl('tab-frames');
const tabEditImg = getIconUrl('tab-edit');
importFilters();

/**
 * Toolspace shrinks as the window gets shorter: first the color slider, then the tool row and
 * layer preview become small, then the layer preview hides. Only after that does it overflow.
 */
function getToolspaceLayout(uiHeight: number): {
    isLayerPreviewVisible: boolean;
    isLayerPreviewSmall: boolean;
    isToolRowSmall: boolean;
    colorSliderHeight: number;
} {
    // everything but color slider, with layer preview and large tool row.
    // Measured with the tallest brush tab, so it fits with 10px spacing above the bottom bar.
    const otherContentHeight = 447;
    const toolRowSaving = 18; // when small
    const layerPreviewSmallSaving = 4; // 36px instead of 40px
    const colorSliderMin = 158;
    const colorSliderMax = 400;

    let available = uiHeight - otherContentHeight;
    const isToolRowSmall = available < colorSliderMin;
    if (isToolRowSmall) {
        available += toolRowSaving + layerPreviewSmallSaving;
    }
    const isLayerPreviewSmall = isToolRowSmall;
    const isLayerPreviewVisible = available >= colorSliderMin;
    if (!isLayerPreviewVisible) {
        available += isLayerPreviewSmall ? 26 : 30; // hidden preview keeps a 10px bottom margin
    }
    return {
        isLayerPreviewVisible,
        isLayerPreviewSmall,
        isToolRowSmall,
        colorSliderHeight: Math.max(colorSliderMin, Math.min(colorSliderMax, available)),
    };
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } {
    if (
        bytes.length < 24 ||
        bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71 ||
        bytes[4] !== 13 || bytes[5] !== 10 || bytes[6] !== 26 || bytes[7] !== 10
    ) {
        throw new Error('Package image is not a valid PNG');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}

type TKlAppOptionsEmbed = {
    url: string;
    enableImageDropperImport?: boolean; // default false
    onSubmit: (onSuccess: () => void, onError: () => void) => void;
};

export type TKlAppParams = {
    project?: TKlProject;
    logoImg?: string; // app logo
    bottomBar?: HTMLElement; // row at bottom of toolspace
    helpPath?: string; // default help.html
    embed?: TKlAppOptionsEmbed;
    app?: {
        imgurKey?: string; // for imgur uploads
    };
    aboutEl?: HTMLElement; // replaces info about Klecks in settings tab
    klRecoveryManager?: KlRecoveryManager; // undefined if IndexedDB fails connecting
};

type TKlAppToolId =
    | 'hand'
    | 'brush'
    | 'select'
    | 'eyedropper'
    | 'paintBucket'
    | 'gradient'
    | 'text'
    | 'shape'
    | 'rotate'
    | 'zoom';

export class KlApp {
    private readonly rootEl: HTMLElement;
    private projectPalette: TProjectPaletteData = { colors: [] };
    private uiWidth: number;
    private uiHeight: number;
    private readonly helpPath: string;
    private readonly layerPreview: LayerPreview;
    private readonly floatingLayerPreview: FloatingLayerPreview;
    private readonly klColorSlider: KlColorSlider;
    private readonly toolspaceToolRow: ToolspaceToolRow;
    private readonly statusOverlay: StatusOverlay;
    private readonly klCanvas: KlCanvas;
    private uiLayout: TUiLayout;
    private readonly embed: undefined | TKlAppOptionsEmbed;
    private readonly saveToComputer: SaveToComputer;
    private readonly lineSanitizer: LineSanitizer;
    private readonly easel: Easel<TKlAppToolId>;
    private readonly easelProjectUpdater: EaselProjectUpdater<TKlAppToolId>;
    private readonly easelBrush: EaselBrush;
    private readonly collapseThreshold: number = 820;
    private readonly mobileUi: MobileUi;
    private readonly mobileToolUi: MobileToolUi;
    private readonly mobileColorUi: MobileColorUi;
    private readonly toolspace: HTMLElement;
    private readonly toolspaceInner: HTMLElement;
    private readonly toolWidth: number = 281;
    private readonly toolspaceTopRow: ToolspaceTopRow | EmbedToolspaceTopRow;
    private readonly bottomBar: HTMLElement | undefined;
    private readonly layersUi: LayersUi;
    private readonly bottomBarWrapper: HTMLElement;
    private readonly saveReminder: SaveReminder | undefined;
    private readonly unloadWarningTrigger: UnloadWarningTrigger | undefined;
    private lastSavedHistoryIndex: number = 0;
    private readonly klHistory: KlHistory;
    private getActiveFrameState?: () => TActiveFrameSet | undefined;

    private updateLastSaved(): void {
        this.lastSavedHistoryIndex = this.klHistory.getTotalIndex();
        this.saveReminder?.reset();
        this.unloadWarningTrigger?.update();
    }

    private updateCollapse(): void {
        this.mobileUi.setOrientation(this.uiLayout);
        if (this.uiWidth < this.collapseThreshold) {
            this.mobileUi.setIsVisible(true);
            if (this.mobileUi.getToolspaceIsOpen()) {
                if (this.uiLayout === 'left') {
                    css(this.easel.getElement(), {
                        left: 281,
                    });
                } else {
                    css(this.easel.getElement(), {
                        left: 0,
                    });
                }
                this.toolspace.style.display = 'block';
                this.easel.setSize(Math.max(0, this.uiWidth - this.toolWidth), this.uiHeight);
                this.statusOverlay.setWide(false);
            } else {
                if (this.uiLayout === 'left') {
                    css(this.easel.getElement(), {
                        left: 0,
                    });
                } else {
                    css(this.easel.getElement(), {
                        left: 0,
                    });
                }
                this.toolspace.style.display = 'none';
                this.easel.setSize(Math.max(0, this.uiWidth), this.uiHeight);
                this.statusOverlay.setWide(true);
            }
        } else {
            this.mobileUi.setIsVisible(false);
            if (this.uiLayout === 'left') {
                css(this.easel.getElement(), {
                    left: 281,
                });
            }
            this.toolspace.style.display = 'block';
            this.easel.setSize(Math.max(0, this.uiWidth - this.toolWidth), this.uiHeight);
            this.statusOverlay.setWide(false);
        }
    }

    private updateUi(): void {
        this.toolspace.classList.toggle('kl-toolspace--left', this.uiLayout === 'left');
        this.toolspace.classList.toggle('kl-toolspace--right', this.uiLayout === 'right');
        if (this.uiLayout === 'left') {
            css(this.toolspace, {
                left: 0,
                right: '',
            });
            css(this.easel.getElement(), {
                left: 281,
            });
        } else {
            css(this.toolspace, {
                left: '',
                right: 0,
            });
            css(this.easel.getElement(), {
                left: 0,
            });
        }
        this.statusOverlay.setUiState(this.uiLayout);
        this.floatingLayerPreview.setUiState(this.uiLayout);
        this.updateCollapse();
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: TKlAppParams) {
        setupUnfocusOnClickService();
        this.projectPalette = normalizePalette(p.project?.palette);
        this.embed = p.embed;
        this.helpPath = p.helpPath ?? 'help.html';
        // Keep mobile's existing 4096px limit. Desktop can use the largest
        // square layer permitted by P8's 1 GiB per-layer memory budget.
        const isMobileDevice =
            /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const memoryBoundedCanvasSize = maxLayersFor(16384, 16384) > 0 ? 16384 : 4096;
        const maxCanvasSize = isMobileDevice ? 4096 : memoryBoundedCanvasSize;
        this.uiLayout = (
            this.embed
                ? 'left'
                : LocalStorage.getItem('uiState')
                  ? LocalStorage.getItem('uiState')
                  : 'right'
        ) as TUiLayout;
        const projectStore = KL_INDEXED_DB.getIsAvailable() ? new ProjectStore() : undefined;
        const remoteProjectStore = new RemoteProjectStore();
        this.rootEl = BB.el({
            className: 'g-root',
            css: {
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            },
        });

        this.uiWidth = Math.max(0, window.innerWidth);
        this.uiHeight = Math.max(0, window.innerHeight);
        let exportType: TExportType = 'png';

        const initialWidth = Math.max(
            10,
            Math.min(
                maxCanvasSize,
                window.innerWidth < this.collapseThreshold
                    ? this.uiWidth
                    : this.uiWidth - this.toolWidth,
            ),
        );
        const initialHeight = Math.max(10, Math.min(maxCanvasSize, this.uiHeight));

        this.klHistory = new KlHistory({
            oldest: projectToComposed(
                p.project ?? {
                    projectId: randomUuid(),
                    width: initialWidth,
                    height: initialHeight,
                    layers: [
                        {
                            name: LANG('layers-layer') + ' 1', // not ideal
                            opacity: 1,
                            isVisible: true,
                            mixModeStr: 'source-over',
                            hasClipping: false,
                            image: {
                                fill: BB.ColorConverter.toRgbStr({
                                    r: ERASE_COLOR,
                                    g: ERASE_COLOR,
                                    b: ERASE_COLOR,
                                }),
                            },
                        },
                    ],
                },
            ),
        });
        const klRecoveryManager = p.klRecoveryManager;
        if (klRecoveryManager) {
            klRecoveryManager.setKlHistory(this.klHistory);
            klRecoveryManager.setGetThumbnail((factor) => this.klCanvas.getCanvas(factor));
        }
        if (p.project) {
            // attempt at freeing memory
            p.project.layers.forEach((layer) => {
                if (layer.image instanceof HTMLCanvasElement) {
                    BB.freeCanvas(layer.image);
                }
                layer.image = null as any;
            });
        }

        this.klCanvas = new KL.KlCanvas(this.klHistory, this.embed ? -1 : 1);
        let serverProjectDirty = false;
        let serverProjectCleanChangeCount = this.klHistory.getChangeCount();
        let refreshServerProjectHeader = () => {};
        const markServerProjectClean = () => {
            serverProjectCleanChangeCount = this.klHistory.getChangeCount();
            serverProjectDirty = false;
            refreshServerProjectHeader();
        };
        const tempHistory = new KlTempHistory();
        let mainTabRow: TabRow | undefined = undefined;
        let activeFrameState: TActiveFrameSet | undefined;
        let showOriginal = false;
        let showOnionSkin = false;
        let overlayOpacity = 0.35;
        let renderOverlays: { image: CanvasImageSource; opacity: number }[] = [];
        let onionComposite: { frame: TFrame; canvas: HTMLCanvasElement } | undefined;
        const referenceImageCache = new Map<string, CanvasImageSource>();
        // Keep exact source/composite pixels per frame so export never rasterizes
        // every stored layer through a shared canvas path.
        const framePixelCache = new Map<string, Uint8Array>();
        let overlayRequestId = 0;
        let frameThumbnailRefreshTimeout: ReturnType<typeof setTimeout> | undefined;
        this.getActiveFrameState = () => activeFrameState;
        let framesUi: FramesUi | undefined;
        let refreshGifExportAvailability: (() => void) | undefined;
        let isFrameActionInProgress = false;

        const clearLayer = (showStatus?: boolean, ignoreSelection?: boolean) => {
            applyUncommitted();
            const layerIndex = currentLayerIndex;
            this.klCanvas.eraseLayer({
                layerIndex,
                useAlphaLock: layerIndex === 0 && !brushUiMap.eraserBrush.getIsTransparentBg(),
                useSelection: !ignoreSelection,
            });
            showStatus &&
                this.statusOverlay.out(
                    this.klCanvas.getSelection()
                        ? LANG('cleared-selected-area')
                        : LANG('cleared-layer'),
                    true,
                );
        };

        let currentColor = new BB.RGB(0, 0, 0);
        let paletteUi: ProjectPaletteUi | undefined;
        let currentBrushUi: TBrushUiInstance<any>;
        let currentBrushId: TBrushId;
        let lastNonEraserBrushId: TBrushId;
        let currentLayerIndex: number = this.klCanvas.getLayerCount() - 1;

        // when cycling through brushes you need to know the next non-eraser brush
        const getNextBrushId = (): TBrushId => {
            if (currentBrushId === 'eraserBrush') {
                return lastNonEraserBrushId;
            }
            const keyArr = (Object.keys(KL.BRUSHES_UI) as TBrushId[]).filter(
                (item) => item !== 'eraserBrush',
            );
            const i = keyArr.findIndex((item) => item === currentBrushId);
            return keyArr[(i + 1) % keyArr.length];
        };

        const sizeWatcher = (val: number) => {
            brushSettingService.emitSize(val);
            if (this.easelBrush) {
                this.easelBrush.setBrush({ radius: val });
            }
        };

        const brushSettingService = new KL.BrushSettingService({
            onSetColor: (color) => {
                this.klColorSlider.setColor(color);
                currentBrushUi.setColor(color);
                this.mobileColorUi.setColor(color);
                currentColor = BB.copyObj(color);
                paletteUi?.setCurrentPrimaryColor(currentColor);
            },
            onSetSize: (size) => {
                currentBrushUi.setSize(size);
                this.easelBrush.setBrush({ radius: size });
            },
            onSetOpacity: (opacity) => {
                currentBrushUi.setOpacity(opacity);
            },
            onGetColor: () => this.klColorSlider.getColor(),
            onGetSize: () => brushUiMap[currentBrushId].getSize(),
            onGetOpacity: () => brushUiMap[currentBrushId].getOpacity(),
            onGetSliderConfig: () => {
                return {
                    sizeSlider: KL.BRUSHES_UI[currentBrushId].sizeSlider,
                    opacitySlider: KL.BRUSHES_UI[currentBrushId].opacitySlider,
                };
            },
        });

        const lineSmoothing = new LineSmoothing({
            smoothing: translateSmoothing(1),
        });
        this.lineSanitizer = new LineSanitizer();

        const drawEventChain = new BB.EventChain({
            chainArr: [this.lineSanitizer as any, lineSmoothing as any],
        });

        drawEventChain.setChainOut(((event: TDrawEvent) => {
            if (event.type === 'down') {
                this.toolspace.style.pointerEvents = 'none';
                currentBrushUi.startLine(event.x, event.y, event.pressure);
                this.easelBrush.setLastDrawEvent({ x: event.x, y: event.y });
                this.easel.requestRender();
            }
            if (event.type === 'move') {
                currentBrushUi.goLine(event.x, event.y, event.pressure, event.isCoalesced);
                this.easelBrush.setLastDrawEvent({ x: event.x, y: event.y });
                this.easel.requestRender();
            }
            if (event.type === 'up') {
                this.toolspace.style.pointerEvents = '';
                currentBrushUi.endLine();
                this.easel.requestRender();
            }
            if (event.type === 'line') {
                currentBrushUi.getBrush().drawLineSegment(event.x0, event.y0, event.x1, event.y1);
                this.easelBrush.setLastDrawEvent({ x: event.x1, y: event.y1 });
                this.easel.requestRender();
            }
        }) as any);

        let textToolSettings = {
            size: 20,
            align: 'left' as 'left' | 'center' | 'right',
            isBold: false,
            isItalic: false,
            font: 'sans-serif',
            letterSpacing: 0,
            lineHeight: 1,
            fill: {
                color: { r: 0, g: 0, b: 0, a: 1 },
            },
        } as TRenderTextParam;

        /**
         * Uncommited action is something like select tool > transform which puts the canvas and UI into
         * a temporary state. Changes need to be committed or discarded *before* doing something else.
         *
         * returns true if something was applied
         */
        const applyUncommitted = (): boolean => {
            return klAppSelect.commitTransform();
        };

        /** see applyUncommitted **/
        const discardUncommitted = (): boolean => {
            return klAppSelect.discardTransform();
        };

        const propagateUndoRedoChanges = (
            type: THistoryExecutionType,
            composedBefore: THistoryEntryDataComposed,
        ) => {
            if (['undo', 'redo'].includes(type)) {
                const composedAfter = this.klHistory.getComposed();

                this.klCanvas.updateViaComposed(composedBefore!, composedAfter);

                setCurrentLayer(composedAfter.layerMap[composedAfter.activeLayerId].index);
                this.easelProjectUpdater.update(); // triggers render

                const dimensionChanged =
                    composedBefore.size.width !== composedAfter.size.width ||
                    composedBefore.size.height !== composedAfter.size.height;
                if (dimensionChanged) {
                    this.easel.resetOrFitTransform(true);
                }
                this.easelBrush.setLastDrawEvent();
                this.layersUi.update(currentLayerIndex);
            }

            klAppSelect.onHistory(type);
        };

        const undo = (showMessage?: boolean) => {
            if (isFrameActionInProgress) return;
            if (!tempHistory.canDecreaseIndex()) {
                discardUncommitted();
            }
            const composedBefore = this.klHistory.getComposed();
            const result = klHistoryExecutor.undo();
            if (!result) {
                // didn't do anything
                return;
            }
            propagateUndoRedoChanges(result.type, composedBefore);
            if (showMessage) {
                this.statusOverlay.out(LANG('undo'), true);
            }
        };

        const redo = (showMessage?: boolean) => {
            if (isFrameActionInProgress) return;
            const composedBefore = this.klHistory.getComposed();
            const result = klHistoryExecutor.redo();
            if (!result) {
                // didn't do anything
                return;
            }
            propagateUndoRedoChanges(result.type, composedBefore);
            if (showMessage) {
                this.statusOverlay.out(LANG('redo'), true);
            }
        };

        this.statusOverlay = new KL.StatusOverlay();

        const klAppSelect = new KlAppSelect({
            klCanvas: this.klCanvas,
            onChangeMode: () => this.mobileToolUi.update(),
            getCurrentLayerIndex: () => currentLayerIndex,
            onUpdateProject: () => this.easelProjectUpdater.update(),
            klHistory: this.klHistory,
            tempHistory,
            statusOverlay: this.statusOverlay,
            onFill: () => {
                this.klCanvas.layerFill(
                    currentLayerIndex,
                    this.klColorSlider.getColor(),
                    undefined,
                    true,
                );
                this.statusOverlay.out(
                    this.klCanvas.getSelection() ? LANG('filled-selected-area') : LANG('filled'),
                    true,
                );
            },
            onErase: () => {
                const layerIndex = currentLayerIndex;
                this.klCanvas.eraseLayer({
                    layerIndex,
                    useAlphaLock: layerIndex === 0 && !brushUiMap.eraserBrush.getIsTransparentBg(),
                    useSelection: true,
                });
                this.statusOverlay.out(
                    this.klCanvas.getSelection()
                        ? LANG('cleared-selected-area')
                        : LANG('cleared-layer'),
                    true,
                );
            },
        });

        this.easelBrush = new EaselBrush({
            radius: 5,
            onLineStart: (e) => {
                // expects TDrawEvent
                drawEventChain.chainIn({
                    type: 'down',
                    scale: this.easel.getTransform().scale,
                    shiftIsPressed: keyListener.isPressed('shift'),
                    pressure: e.pressure,
                    isCoalesced: e.isCoalesced,
                    x: e.x,
                    y: e.y,
                } as any);
            },
            onLineGo: (e) => {
                // expects TDrawEvent
                drawEventChain.chainIn({
                    type: 'move',
                    scale: this.easel.getTransform().scale,
                    shiftIsPressed: keyListener.isPressed('shift'),
                    pressure: e.pressure,
                    isCoalesced: e.isCoalesced,
                    x: e.x,
                    y: e.y,
                } as any);
            },
            onLineEnd: () => {
                // expects TDrawEvent
                drawEventChain.chainIn({
                    type: 'up',
                    scale: this.easel.getTransform().scale,
                    shiftIsPressed: keyListener.isPressed('shift'),
                    isCoalesced: false,
                } as any);
            },
            onLine: (p1, p2) => {
                // expects TDrawEvent
                drawEventChain.chainIn({
                    type: 'line',
                    x0: p1.x,
                    y0: p1.y,
                    x1: p2.x,
                    y1: p2.y,
                    pressure0: 1,
                    pressure1: 1,
                } as any);
            },
        });

        const easelHand = new EaselHand({});
        const easelShape = new EaselShape({
            onDown: (p, angleRad) => {
                shapeTool.onDown(p.x, p.y, angleRad);
            },
            onMove: (p) => {
                shapeTool.onMove(p.x, p.y);
            },
            onUp: (p) => {
                shapeTool.onUp(p.x, p.y);
            },
        });

        let isFirstTransform = true;
        this.easel = new Easel({
            onBeforeRender: () => {
                currentBrushUi?.getBrush().transferToCanvas?.();
            },
            width: Math.max(0, this.uiWidth - this.toolWidth),
            height: this.uiHeight,
            project: {
                width: this.klCanvas.getWidth(),
                height: this.klCanvas.getHeight(),
                layers: [],
            }, // temp
            tools: {
                brush: this.easelBrush,
                hand: easelHand,
                select: klAppSelect.getEaselSelect(),
                eyedropper: new EaselEyedropper({
                    onPick: (p) => {
                        const color = this.klCanvas.getColorAt(p.x, p.y);
                        if (color) {
                            brushSettingService.setColor(color);
                            return color;
                        }
                        return brushSettingService.getColor();
                    },
                    onPickEnd: () => {
                        if (
                            this.klColorSlider.getIsEyedropping() ||
                            this.mobileColorUi.getIsEyedropping()
                        ) {
                            this.klColorSlider.setIsEyedropping(false);
                            this.mobileColorUi.setIsEyedropping(false);
                            this.easel.setTool(this.toolspaceToolRow.getActive());
                        }
                    },
                }),
                paintBucket: new EaselPaintBucket({
                    onFill: (p) => {
                        this.klCanvas.floodFill(
                            currentLayerIndex,
                            p.x,
                            p.y,
                            fillUi.getIsEraser() ? null : this.klColorSlider.getColor(),
                            fillUi.getOpacity(),
                            fillUi.getTolerance(),
                            fillUi.getSample(),
                            fillUi.getGrow(),
                            fillUi.getContiguous(),
                        );
                        this.easel.requestRender();
                    },
                }),
                gradient: new EaselGradient({
                    onDown: (p, angleRad) => {
                        gradientTool.onDown(p.x, p.y, angleRad);
                    },
                    onMove: (p) => {
                        gradientTool.onMove(p.x, p.y);
                    },
                    onUp: (p) => {
                        gradientTool.onUp(p.x, p.y);
                    },
                }),
                text: new EaselText({
                    onDown: (p, angleRad) => {
                        if (KL.DIALOG_COUNTER.get() > 0) {
                            return;
                        }

                        KL.textToolDialog({
                            klCanvas: this.klCanvas,
                            layerIndex: currentLayerIndex,
                            primaryColor: this.klColorSlider.getColor(),
                            secondaryColor: this.klColorSlider.getSecondaryRGB(),

                            text: {
                                ...textToolSettings,
                                text: '',
                                x: p.x,
                                y: p.y,
                                angleRad: angleRad,
                                fill: textToolSettings.fill
                                    ? {
                                          color: {
                                              ...this.klColorSlider.getColor(),
                                              a: textToolSettings.fill.color.a,
                                          },
                                      }
                                    : undefined,
                                stroke: textToolSettings.stroke
                                    ? {
                                          ...textToolSettings.stroke,
                                          color: {
                                              ...this.klColorSlider.getSecondaryRGB(),
                                              a: textToolSettings.stroke.color.a,
                                          },
                                      }
                                    : undefined,
                            },

                            onConfirm: (val) => {
                                textToolSettings = {
                                    ...val,
                                    text: '',
                                };
                                if (val.fill) {
                                    brushSettingService.setColor(
                                        new BB.RGB(
                                            val.fill.color.r,
                                            val.fill.color.g,
                                            val.fill.color.b,
                                        ),
                                    );
                                }
                                this.klCanvas.text(currentLayerIndex, val);
                            },
                        });
                    },
                }),
                shape: easelShape,
                rotate: new EaselRotate({}),
                zoom: new EaselZoom({}),
            },
            tool: 'brush',
            onChangeTool: (toolId) => {
                if (toolId !== 'brush' && toolId !== 'eyedropper') {
                    currentBrushUi.freeResources?.();
                }
                this.mobileToolUi.update();
            },
            onTransformChange: (transform, isScaleOrAngleChanged) => {
                handUi.update(transform.scale, transform.angleDeg, transform.isMirrored);
                this.toolspaceToolRow.setEnableZoomIn(transform.scale !== EASEL_MAX_SCALE);
                this.toolspaceToolRow.setEnableZoomOut(transform.scale !== EASEL_MIN_SCALE);

                if (isScaleOrAngleChanged && !isFirstTransform) {
                    this.statusOverlay.out({
                        type: 'transform',
                        scale: transform.scale,
                        angleDeg: transform.angleDeg,
                    });
                }
                if (isFirstTransform) {
                    isFirstTransform = false;
                }
            },
            onUndo: () => {
                undo(true);
            },
            onRedo: () => {
                redo(true);
            },
            onResetSelection: () => klAppSelect.resetSelection(),
        });
        css(this.easel.getElement(), {
            position: 'absolute',
            left: 0,
            top: 0,
        });
        this.easelProjectUpdater = new EaselProjectUpdater({
            klCanvas: this.klCanvas,
            easel: this.easel,
            getRenderOverlays: () => renderOverlays,
        });
        this.klHistory.addListener(() => {
            this.easelProjectUpdater.update();
            serverProjectDirty = this.klHistory.getChangeCount() !== serverProjectCleanChangeCount;
            refreshServerProjectHeader();
        });
        KL.DIALOG_COUNTER.subscribe((count) => {
            this.easel.setIsFrozen(count > 0);
        });

        const updateMainTabVisibility = () => {
            if (!mainTabRow) {
                return;
            }

            const toolObj = {
                brush: {},
                hand: {},
                paintBucket: {},
                gradient: {},
                text: {},
                shape: {},
                select: {},
            };

            const activeStr = this.toolspaceToolRow.getActive();
            const oldTabId = mainTabRow.getOpenedTabId();

            const keysArr = Object.keys(toolObj);
            for (let i = 0; i < keysArr.length; i++) {
                if (activeStr === keysArr[i]) {
                    mainTabRow.setIsVisible(keysArr[i], true);
                } else {
                    mainTabRow.setIsVisible(keysArr[i], false);
                    if (oldTabId === keysArr[i]) {
                        mainTabRow.open(activeStr);
                    }
                }
            }
        };

        const keyListener = new BB.KeyListener({
            onDown: (keyStr, event, comboStr, isRepeat) => {
                if (isFrameActionInProgress) {
                    return;
                }
                if (KL.DIALOG_COUNTER.get() > 0 || BB.isInputFocused(true)) {
                    return;
                }

                const isDrawing = this.lineSanitizer.getIsDrawing() || this.easel.getIsLocked();
                if (isDrawing) {
                    return;
                }

                if (comboStr === 'home' && !isRepeat) {
                    this.easel.fitTransform();
                }
                if (comboStr === 'end' && !isRepeat) {
                    this.easel.resetTransform();
                }
                // more reliably this way
                const isCtrlOrCmd = (event.ctrlKey || event.metaKey) && !event.altKey;
                const isShift = event.shiftKey;
                // ctrl+z
                const isUndo = isCtrlOrCmd && !isShift && keyStr === 'z';
                // ctrl+shift+z or ctrl+y
                const isRedo =
                    (isCtrlOrCmd && isShift && keyStr === 'z') || (isCtrlOrCmd && keyStr === 'y');
                if (isUndo) {
                    event.preventDefault();
                    undo();
                }
                if (isRedo) {
                    event.preventDefault();
                    redo();
                }
                if (!this.embed) {
                    if (['ctrl+s', 'cmd+s'].includes(comboStr) && !isRepeat) {
                        event.preventDefault();
                        applyUncommitted();
                        this.saveToComputer.save();
                    }
                    if (['ctrl+shift+s', 'cmd+shift+s'].includes(comboStr) && !isRepeat) {
                        event.preventDefault();
                        applyUncommitted();
                        if (projectStore) {
                            (async () => {
                                await requestPersistentStorage();

                                const meta = projectStore!.getCurrentMeta();
                                const project = this.getProject();

                                if (meta && meta.projectId !== project.projectId) {
                                    const doOverwrite = await new Promise<boolean>(
                                        (resolve, reject) => {
                                            showModal({
                                                type: 'warning',
                                                message: LANG('file-storage-overwrite-confirm'),
                                                buttons: [
                                                    {
                                                        id: 'overwrite',
                                                        label: LANG('file-storage-overwrite'),
                                                    },
                                                    'Cancel',
                                                ],
                                                callback: async (result) => {
                                                    if (result === 'Cancel') {
                                                        resolve(false);
                                                        return;
                                                    }
                                                    resolve(true);
                                                },
                                            });
                                        },
                                    );
                                    if (!doOverwrite) {
                                        return;
                                    }
                                }

                                let success = true;
                                try {
                                    await projectStore!.store(this.getProject());
                                } catch (e) {
                                    success = false;
                                    asyncThrow(
                                        new Error(
                                            'keyboard-shortcut: failed to store browser storage, ' +
                                                e,
                                        ),
                                    );
                                    this.statusOverlay.out(
                                        '❌ ' + LANG('file-storage-failed'),
                                        true,
                                    );
                                }
                                if (success) {
                                    this.updateLastSaved();
                                    this.statusOverlay.out(LANG('file-storage-stored'), true);
                                }
                            })();
                        } else {
                            this.statusOverlay.out('❌ ' + LANG('file-storage-failed'), true);
                        }
                    }
                    if (['ctrl+c', 'cmd+c'].includes(comboStr) && !isRepeat) {
                        event.preventDefault();
                        applyUncommitted();
                        copyToClipboard(true);
                    }
                }
                if (['ctrl+a', 'cmd+a'].includes(comboStr)) {
                    event.preventDefault();
                }

                if (comboStr === 'sqbr_open') {
                    currentBrushUi.decreaseSize(
                        Math.max(0.005, 0.03 / this.easel.getTransform().scale),
                    );
                }
                if (comboStr === 'sqbr_close') {
                    currentBrushUi.increaseSize(
                        Math.max(0.005, 0.03 / this.easel.getTransform().scale),
                    );
                }
                if (comboStr === 'enter' && !isRepeat) {
                    if (!applyUncommitted()) {
                        this.klCanvas.layerFill(
                            currentLayerIndex,
                            this.klColorSlider.getColor(),
                            undefined,
                            true,
                        );
                        this.statusOverlay.out(
                            this.klCanvas.getSelection()
                                ? LANG('filled-selected-area')
                                : LANG('filled'),
                            true,
                        );
                    }
                }
                if (comboStr === 'esc' && !isRepeat) {
                    if (discardUncommitted()) {
                        event.preventDefault();
                    }
                }
                if (['delete', 'backspace'].includes(comboStr) && !isRepeat) {
                    clearLayer(true);
                }
                if ((comboStr === 'ctrl+shift+e' || comboStr === 'shift+ctrl+e') && !isRepeat) {
                    event.preventDefault();
                    this.layersUi.advancedMergeDialog();
                }
                if (comboStr === 'shift+e' && !isRepeat) {
                    event.preventDefault();
                    currentBrushUi.toggleEraser?.();
                } else if (['e', 'p', 'v'].includes(comboStr) && !isRepeat) {
                    event.preventDefault();
                    applyUncommitted();
                    this.toolspaceToolRow.setActive('brush');
                    this.easel.setTool('brush');
                    mainTabRow?.open('brush');
                    updateMainTabVisibility();
                    brushTabRow.open(
                        comboStr === 'e'
                            ? 'eraserBrush'
                            : comboStr === 'p'
                              ? 'penBrush'
                              : 'blendBrush',
                    );
                }
                if (comboStr === 'b' && !isRepeat) {
                    event.preventDefault();
                    const prevMode = this.easel.getTool();
                    const prevMainTabId = mainTabRow?.getOpenedTabId();
                    applyUncommitted();
                    this.toolspaceToolRow.setActive('brush');
                    this.easel.setTool('brush');
                    mainTabRow?.open('brush');
                    updateMainTabVisibility();
                    brushTabRow.open(
                        prevMode === 'brush' && prevMainTabId === 'brush'
                            ? getNextBrushId()
                            : currentBrushId === 'eraserBrush'
                              ? lastNonEraserBrushId
                              : currentBrushId,
                    );
                }
                if (comboStr === 'h' && !isRepeat) {
                    event.preventDefault();
                    this.toolspaceToolRow.setActive('hand', true);
                }
                if (comboStr === 'g' && !isRepeat) {
                    event.preventDefault();
                    applyUncommitted();
                    const newMode =
                        this.easel.getTool() === 'paintBucket' ? 'gradient' : 'paintBucket';
                    this.toolspaceToolRow.setActive(newMode);
                    this.easel.setTool(newMode);
                    mainTabRow?.open(newMode);
                    updateMainTabVisibility();
                }
                if (comboStr === 't' && !isRepeat) {
                    event.preventDefault();
                    applyUncommitted();
                    this.toolspaceToolRow.setActive('text');
                    this.easel.setTool('text');
                    mainTabRow?.open('text');
                    updateMainTabVisibility();
                }
                if (comboStr === 'u' && !isRepeat) {
                    event.preventDefault();
                    applyUncommitted();
                    this.toolspaceToolRow.setActive('shape');
                    this.easel.setTool('shape');
                    mainTabRow?.open('shape');
                    updateMainTabVisibility();
                }
                if (comboStr === 'l' && !isRepeat) {
                    event.preventDefault();
                    const prevTool = this.easel.getTool();
                    const prevSelectMode = klAppSelect.getSelectMode();
                    const prevMainTabId = mainTabRow?.getOpenedTabId();
                    // coming from hand -> keep uncommitted transform, so it can be resumed
                    if (prevTool !== 'hand') {
                        applyUncommitted();
                    }
                    this.toolspaceToolRow.setActive('select');
                    this.easel.setTool('select');
                    mainTabRow?.open('select');
                    updateMainTabVisibility();
                    if (
                        prevTool === 'select' &&
                        prevSelectMode === 'select' &&
                        prevMainTabId === 'select'
                    ) {
                        klAppSelect.getSelectUi().setMode('transform');
                    }
                }
                if (comboStr === 'x' && !isRepeat) {
                    event.preventDefault();
                    this.klColorSlider.swapColors();
                }
                if (comboStr === 'm' && !isRepeat) {
                    event.preventDefault();
                    this.easel.setIsMirrored(!this.easel.getIsMirrored());
                }
            },
            onUp: (keyStr, event) => {},
        });

        const brushUiMap: {
            [key: string]: any;
        } = {};
        // create brush UIs
        Object.entries(KL.BRUSHES_UI).forEach(([b, brushUi]) => {
            const ui = new (brushUi.Ui as any)({
                klHistory: this.klHistory,
                onSizeChange: sizeWatcher,
                onOpacityChange: (opacity: number) => {
                    brushSettingService.emitOpacity(opacity);
                },
                onConfigChange: () => {
                    brushSettingService.emitSliderConfig({
                        sizeSlider: KL.BRUSHES_UI[currentBrushId].sizeSlider,
                        opacitySlider: KL.BRUSHES_UI[currentBrushId].opacitySlider,
                    });
                    updateBrushCursor();
                },
            });
            brushUiMap[b] = ui;
            // no bottom padding. spacer above bottom bar provides it
            ui.getElement().style.padding = '10px 10px 0';
        });

        this.toolspace = BB.el({
            className: 'kl-toolspace',
            css: {
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: this.toolWidth,
                overflowY: 'auto',
                overflowX: 'hidden',
                overscrollBehavior: 'contain',
                scrollbarGutter: 'stable',
                userSelect: 'none',
                touchAction: 'pan-y',
            },
        });
        this.toolspaceInner = BB.el({
            parent: this.toolspace,
            css: {
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100%',
            },
        });
        this.toolspace.oncontextmenu = () => {
            return false;
        };
        this.toolspace.onclick = BB.handleClick;

        this.mobileToolUi = new MobileToolUi({
            getToolId: () => this.toolspaceToolRow.getActive(),
            getSelectMode: () => klAppSelect.getSelectMode(),
            getCurrentBrushId: () => currentBrushId,
            getLastNonEraserBrushId: () => lastNonEraserBrushId,
            brushArr: (Object.keys(KL.BRUSHES_UI) as TBrushId[])
                .filter((id) => id !== 'eraserBrush')
                .map((id) => ({
                    id,
                    image: KL.BRUSHES_UI[id].image,
                    title: KL.BRUSHES_UI[id].tooltip,
                })),
            brushSettingService,
            onBrush: (brushId) => {
                this.toolspaceToolRow.setActive('brush', true);
                brushTabRow.open(brushId);
            },
            onTool: (toolId) => {
                if (toolId === 'select' || toolId === 'transform') {
                    this.toolspaceToolRow.setActive('select', true);
                    // transform can be rejected, if there's nothing to transform
                    return klAppSelect
                        .getSelectUi()
                        .setMode(toolId === 'select' ? 'select' : 'transform');
                }
                this.toolspaceToolRow.setActive(toolId, true);
                return true;
            },
        });
        this.mobileColorUi = new MobileColorUi({
            onEyedropper: (isActive) => {
                if (isActive) {
                    this.klColorSlider.setIsEyedropping(true);
                    this.easel.setTool('eyedropper');
                } else {
                    this.klColorSlider.setIsEyedropping(false);
                    this.easel.setTool(this.toolspaceToolRow.getActive());
                }
            },
            color: currentColor,
            onColorChange: (c) => {
                brushSettingService.setColor(c);
            },
        });

        this.mobileUi = new MobileUi({
            orientation: this.uiLayout,
            isVisible: this.uiWidth < this.collapseThreshold,
            onShowToolspace: (b) => {
                this.updateCollapse();
            },
            colorUi: this.mobileColorUi,
            toolUi: this.mobileToolUi,
            onUndo: () => undo(),
            onRedo: () => redo(),
        });

        this.updateCollapse();

        let overlayToolspace;
        setTimeout(() => {
            overlayToolspace = new KL.OverlayToolspace({
                enabledTest: () => {
                    return KL.DIALOG_COUNTER.get() === 0 && !this.easel.getIsLocked();
                },
                brushSettingService,
            });
            this.rootEl.append(overlayToolspace.getElement());
        }, 0);

        BB.append(this.rootEl, [
            this.easel.getElement(),
            // this.klCanvasWorkspace.getElement(),
            this.toolspace,
            this.mobileUi.getElement(),
        ]);

        if (this.embed) {
            this.toolspaceTopRow = new EmbedToolspaceTopRow({
                onHelp: () => {
                    showIframeModal(this.embed!.url + this.helpPath, !!this.embed);
                },
                onSubmit: () => {
                    applyUncommitted();
                    const onFailure = () => {
                        let closeFunc: () => void;
                        const saveBtn = BB.el({
                            tagName: 'button',
                            className: 'kl-button',
                            textContent: LANG('save-reminder-save-psd'),
                            css: {
                                display: 'block',
                            },
                        });
                        saveBtn.onclick = () => {
                            this.saveAsPsd();
                            closeFunc();
                        };
                        showModal({
                            message: '<b>' + LANG('upload-failed') + '</b>',
                            div: BB.el({
                                content: [
                                    BB.el({
                                        content: LANG('backup-drawing'),
                                        css: {
                                            marginBottom: 10,
                                        },
                                    }),
                                    saveBtn,
                                ],
                            }),
                            ignoreBackground: true,
                            closeFunc: (f) => {
                                closeFunc = f;
                            },
                        });
                    };

                    showModal({
                        message: LANG('submit-prompt'),
                        buttons: [{ id: 'submit', label: LANG('submit') }, 'Cancel'],
                        callback: async (result) => {
                            if (result !== 'submit') {
                                return;
                            }

                            const overlay = BB.el({
                                parent: this.rootEl,
                                className: 'upload-overlay',
                                content: '<div class="spinner"></div> ' + LANG('submit-submitting'),
                            });

                            this.embed!.onSubmit(
                                () => {
                                    this.updateLastSaved();
                                    overlay.remove();
                                },
                                () => {
                                    overlay.remove();
                                    onFailure();
                                },
                            );
                        },
                    });
                },
                onLeftRight: () => {
                    this.uiLayout = this.uiLayout === 'left' ? 'right' : 'left';
                    this.updateUi();
                },
            });
        } else {
            this.toolspaceTopRow = new KL.ToolspaceTopRow({
                logoImg: p.logoImg,
                onLogo: () => {
                    showIframeModal('./home/', !!this.embed);
                },
                onNew: () => {
                    showNewImageDialog();
                },
                onImport: () => {
                    fileUi!.triggerImport();
                },
                onSave: () => {
                    this.saveToComputer.save();
                },
                onShare: () => {
                    shareImage();
                },
                onHelp: () => {
                    showIframeModal(this.helpPath, !!this.embed);
                },
            });
        }
        this.toolspaceTopRow.getElement().style.marginBottom = '10px';
        this.toolspaceInner.append(this.toolspaceTopRow.getElement());

        this.toolspaceToolRow = new KL.ToolspaceToolRow({
            onActivate: (activeStr) => {
                // hand doesn't cause changes. Select -> can resume uncommitted transform after hand
                if (activeStr !== 'hand' && activeStr !== 'select') {
                    applyUncommitted();
                }

                if (activeStr === 'brush') {
                    this.easel.setTool('brush');
                } else if (activeStr === 'hand') {
                    this.easel.setTool('hand');
                } else if (activeStr === 'paintBucket') {
                    this.easel.setTool('paintBucket');
                } else if (activeStr === 'gradient') {
                    this.easel.setTool('gradient');
                } else if (activeStr === 'text') {
                    this.easel.setTool('text');
                } else if (activeStr === 'shape') {
                    this.easel.setTool('shape');
                } else if (activeStr === 'select') {
                    // this.klCanvasWorkspace.setMode('shape');
                    this.easel.setTool('select');
                } else {
                    throw new Error('unknown activeStr');
                }
                mainTabRow?.open(activeStr);
                updateMainTabVisibility();
                this.klColorSlider.setIsEyedropping(false);
                this.mobileColorUi.setIsEyedropping(false);
            },
            onZoomIn: () => {
                const oldScale = this.easel.getTransform().scale;
                const newScale = zoomByStep(
                    oldScale,
                    keyListener.isPressed('shift') ? 1 / 8 : 1 / 2,
                );
                this.easel.scale(newScale / oldScale);
            },
            onZoomOut: () => {
                const oldScale = this.easel.getTransform().scale;
                const newScale = zoomByStep(
                    oldScale,
                    keyListener.isPressed('shift') ? -1 / 8 : -1 / 2,
                );
                this.easel.scale(newScale / oldScale);
            },
            onUndo: () => {
                undo();
            },
            onRedo: () => {
                redo();
            },
        });
        this.toolspaceToolRow.setIsSmall(getToolspaceLayout(this.uiHeight).isToolRowSmall);
        this.toolspaceInner.append(this.toolspaceToolRow.getElement());

        const setBrushColor = (p_color: TRgb) => {
            currentColor = p_color;
            paletteUi?.setCurrentPrimaryColor(p_color);
            this.klColorSlider.setColor(p_color);
            currentBrushUi.setColor(p_color);
            brushSettingService.emitColor(p_color);
            this.mobileColorUi.setColor(p_color);
            this.klColorSlider.setIsEyedropping(false);
            this.mobileColorUi.setIsEyedropping(false);
        };

        this.klColorSlider = new KL.KlColorSlider({
            width: 250,
            height: 30,
            svHeight: 100,
            startValue: new BB.RGB(0, 0, 0),
            onPick: setBrushColor,
            onEyedropper: (isActive) => {
                if (isActive) {
                    this.mobileColorUi.setIsEyedropping(true);
                    this.easel.setTool('eyedropper');
                } else {
                    this.mobileColorUi.setIsEyedropping(false);
                    this.easel.setTool(this.toolspaceToolRow.getActive());
                }
            },
        });
        this.klColorSlider.setHeight(getToolspaceLayout(this.uiHeight).colorSliderHeight);

        const updateBrushCursor = () => {
            const brush = currentBrushUi.getBrush();
            this.easelBrush.setBrush(
                brush instanceof PixelBrush
                    ? { type: 'pixel', pixelTip: brush.getTip() }
                    : { type: 'round' },
            );
        };

        const setCurrentBrush = (brushId: TBrushId) => {
            if (currentBrushUi && brushId !== currentBrushId) {
                currentBrushUi.freeResources?.();
            }
            if (brushId !== 'eraserBrush') {
                lastNonEraserBrushId = brushId;
            }

            if (this.klColorSlider) {
                if (brushId === 'eraserBrush') {
                    this.klColorSlider.enable(false);
                } else {
                    this.klColorSlider.enable(true);
                }
            }

            currentBrushId = brushId;
            currentBrushUi = brushUiMap[brushId];
            currentBrushUi.setColor(currentColor);
            currentBrushUi.setLayer(this.klCanvas.getLayer(currentLayerIndex));
            updateBrushCursor();
            this.toolspaceToolRow.setActive('brush');
            updateMainTabVisibility();
        };

        const setCurrentLayer = (index: number) => {
            currentLayerIndex = index;
            currentBrushUi.setLayer(this.klCanvas.getLayer(currentLayerIndex));
        };

        const showFrameLimitError = () => showError(LANG('frames-limit-reached'));

        const getReferenceUiState = () => {
            const state = activeFrameState;
            const frame = state?.frameSet.frames[state.activeFrameIndex];
            return {
                hasReference: !!frame && state?.frameSet.referenceTrack?.[frame.id] !== undefined,
                hasSelection: !!this.klCanvas.getSelection()?.length,
                canShowOnion: !!state && state.activeFrameIndex > 0,
                showOriginal,
                showOnion: showOnionSkin,
                opacity: overlayOpacity,
            };
        };

        const updateFramesUi = () => {
            const frameIds = new Set(activeFrameState?.frameSet.frames.map((frame) => frame.id) ?? []);
            for (const frameId of framePixelCache.keys()) {
                if (!frameIds.has(frameId)) framePixelCache.delete(frameId);
            }
            for (const frameId of referenceImageCache.keys()) {
                if (!frameIds.has(frameId)) referenceImageCache.delete(frameId);
            }
            if (
                onionComposite &&
                !activeFrameState?.frameSet.frames.includes(onionComposite.frame)
            ) {
                BB.freeCanvas(onionComposite.canvas);
                onionComposite = undefined;
            }
            framesUi?.update(activeFrameState, getReferenceUiState());
            refreshGifExportAvailability?.();
        };

        const loadCanvasImage = async (image: unknown): Promise<CanvasImageSource | undefined> => {
            if (image instanceof Blob) return await loadImageFromBlob(image);
            if (image instanceof HTMLCanvasElement || image instanceof HTMLImageElement) return image;
            return undefined;
        };

        const createFrameComposite = async (frame: TFrame): Promise<HTMLCanvasElement> => {
            if (onionComposite?.frame === frame) return onionComposite.canvas;
            const layers = await Promise.all(
                frame.layers.map(async (layer, index) => ({
                    name: layer.name ?? LANG('layers-layer') + ' ' + (index + 1),
                    isVisible: layer.isVisible ?? true,
                    opacity: layer.opacity ?? 1,
                    mixModeStr: (layer.mixModeStr ?? 'source-over') as TMixMode,
                    hasClipping: layer.hasClipping ?? false,
                    image: await loadCanvasImage(layer.image),
                })),
            );
            if (layers.some((layer) => !layer.image)) {
                throw new Error('Frame image is unavailable for onion skin');
            }
            const canvas = drawProject({
                projectId: this.klCanvas.getProject().projectId,
                width: activeFrameState!.frameSet.width,
                height: activeFrameState!.frameSet.height,
                layers: layers as TKlProject['layers'],
            });
            if (onionComposite) BB.freeCanvas(onionComposite.canvas);
            onionComposite = { frame, canvas };
            return canvas;
        };

        const refreshFrameOverlays = async (): Promise<void> => {
            const requestId = ++overlayRequestId;
            const state = activeFrameState;
            if (!state) {
                renderOverlays = [];
                if (onionComposite) {
                    BB.freeCanvas(onionComposite.canvas);
                    onionComposite = undefined;
                }
                this.easelProjectUpdater.update();
                updateFramesUi();
                return;
            }
            const frame = state.frameSet.frames[state.activeFrameIndex];
            if (!frame) return;
            const overlays: { image: CanvasImageSource; opacity: number }[] = [];
            try {
                if (showOnionSkin && state.activeFrameIndex > 0) {
                    const previousFrame = state.frameSet.frames[state.activeFrameIndex - 1];
                    overlays.push({ image: await createFrameComposite(previousFrame), opacity: overlayOpacity });
                }
                if (showOriginal) {
                    const source = await getReferenceImage(frame.id);
                    if (source) overlays.push({ image: source, opacity: overlayOpacity });
                }
            } catch (error) {
                showError(error instanceof Error ? error.message : LANG('frames-reference-unavailable'));
            }
            if (requestId !== overlayRequestId || state !== activeFrameState) return;
            renderOverlays = overlays;
            this.easelProjectUpdater.update();
            updateFramesUi();
        };

        const getReferenceImage = async (frameId: string): Promise<CanvasImageSource | undefined> => {
            const cached = referenceImageCache.get(frameId);
            if (cached) return cached;
            const image = await loadCanvasImage(activeFrameState?.frameSet.referenceTrack?.[frameId]);
            if (image) referenceImageCache.set(frameId, image);
            return image;
        };

        const setCurrentFrameReference = async (): Promise<void> => {
            if (!activeFrameState) return;
            const frame = activeFrameState.frameSet.frames[activeFrameState.activeFrameIndex];
            const composite = this.klCanvas.getCanvas();
            let image: Blob;
            try {
                image = await canvasToBlob(composite, 'image/png');
            } finally {
                BB.freeCanvas(composite);
            }
            const validation = createFrameSet({
                ...activeFrameState.frameSet,
                referenceTrack: {
                    ...activeFrameState.frameSet.referenceTrack,
                    [frame.id]: image,
                },
            });
            if (!validation.ok) {
                showFrameLimitError();
                return;
            }
            activeFrameState = { ...activeFrameState, frameSet: validation.value };
            referenceImageCache.delete(frame.id);
            await getReferenceImage(frame.id);
            showOriginal = true;
            await refreshFrameOverlays();
        };

        const copyReferenceToCurrentLayer = async (onlySelection: boolean): Promise<void> => {
            if (!activeFrameState) return;
            const frame = activeFrameState.frameSet.frames[activeFrameState.activeFrameIndex];
            const image = await getReferenceImage(frame.id);
            if (!image) return;
            const selection = onlySelection ? this.klCanvas.getSelection() : undefined;
            this.klCanvas.drawOperation(currentLayerIndex, (ctx) => {
                ctx.save();
                try {
                    if (selection) ctx.clip(new Path2D(getSelectionPath2d(selection)));
                    ctx.drawImage(image, 0, 0);
                } finally {
                    ctx.restore();
                }
            });
            this.layersUi.update();
            this.easelProjectUpdater.update();
        };

        const createFrameThumbnail = (): string => {
            return this.createActiveFrameThumbnail();
        };

        const captureCurrentFrame = async (frameId: string): Promise<TFrame | undefined> => {
            const layers = await Promise.all(
                this.klCanvas.getLayers().map(async (layer) => ({
                    id: layer.id,
                    name: layer.name,
                    isVisible: layer.isVisible,
                    opacity: layer.opacity,
                    mixModeStr: layer.mixModeStr,
                    hasClipping: layer.hasClipping,
                    image: await canvasToBlob(layer.canvas, 'image/png'),
                })),
            );
            const composite = this.klCanvas.getCanvas();
            try {
                framePixelCache.set(
                    frameId,
                    new Uint8Array(BB.ctx(composite, { willReadFrequently: true }).getImageData(0, 0, composite.width, composite.height).data),
                );
            } finally {
                BB.freeCanvas(composite);
            }
            const thumbnail = createFrameThumbnail();
            return { id: frameId, layers, thumbnail };
        };

        const createBlankFrame = async (
            frameId = randomUuid(),
            layerId = randomUuid(),
        ): Promise<TFrame> => {
            const blankCanvas = BB.canvas(this.klCanvas.getWidth(), this.klCanvas.getHeight());
            const image = await canvasToBlob(blankCanvas, 'image/png');
            const thumbnailCanvas = BB.canvas(64, 64);
            const thumbnail = thumbnailCanvas.toDataURL('image/png');
            BB.freeCanvas(blankCanvas);
            BB.freeCanvas(thumbnailCanvas);
            return {
                id: frameId,
                layers: [
                    {
                        id: layerId,
                        name: LANG('layers-layer') + ' 1',
                        isVisible: true,
                        opacity: 1,
                        mixModeStr: 'source-over',
                        hasClipping: false,
                        image,
                    },
                ],
                thumbnail,
            };
        };

        const restoreFrame = async (frame: TFrame): Promise<boolean> => {
            if (!activeFrameState) {
                return false;
            }
            const temporaryCanvases: HTMLCanvasElement[] = [];
            try {
                const layers = await Promise.all(
                    frame.layers.map(async (layer, index) => {
                        let source: CanvasImageSource;
                        if (layer.image instanceof Blob) {
                            source = await loadImageFromBlob(layer.image);
                        } else if (
                            layer.image instanceof HTMLCanvasElement ||
                            layer.image instanceof HTMLImageElement
                        ) {
                            source = layer.image;
                        } else {
                            throw new Error('Frame layer image is unavailable');
                        }
                        const canvas = BB.canvas(activeFrameState!.frameSet.width, activeFrameState!.frameSet.height);
                        BB.ctx(canvas).drawImage(source, 0, 0);
                        temporaryCanvases.push(canvas);
                        return {
                            id: layer.id,
                            name: layer.name ?? LANG('layers-layer') + ' ' + (index + 1),
                            isVisible: layer.isVisible ?? true,
                            opacity: layer.opacity ?? 1,
                            mixModeStr: (layer.mixModeStr ?? 'source-over') as TMixMode,
                            hasClipping: layer.hasClipping ?? false,
                            image: canvas,
                        };
                    }),
                );
                const layerIndex = this.klCanvas.reset({
                    projectId: this.klCanvas.getProject().projectId,
                    width: activeFrameState.frameSet.width,
                    height: activeFrameState.frameSet.height,
                    layers,
                });
                if (layerIndex === false) {
                    showFrameLimitError();
                    return false;
                }
                tempHistory.clear();
                tempHistory.setIsActive(false);
                this.klHistory.reseed();
                setCurrentLayer(layerIndex);
                this.layersUi.update(layerIndex);
                this.easelProjectUpdater.update();
                this.easelBrush.setLastDrawEvent();
                return true;
            } finally {
                temporaryCanvases.forEach((canvas) => BB.freeCanvas(canvas));
            }
        };

        const updateActiveFrameFromCanvas = async (): Promise<boolean> => {
            if (!activeFrameState) {
                return true;
            }
            const activeFrame = activeFrameState.frameSet.frames[activeFrameState.activeFrameIndex];
            const captured = await captureCurrentFrame(activeFrame.id);
            if (!captured) {
                return false;
            }
            const frames = [...activeFrameState.frameSet.frames];
            frames[activeFrameState.activeFrameIndex] = captured;
            const result = createFrameSet({
                ...activeFrameState.frameSet,
                frames,
            });
            if (!result.ok) {
                showFrameLimitError();
                return false;
            }
            activeFrameState = { frameSet: result.value, activeFrameIndex: activeFrameState.activeFrameIndex };
            return true;
        };

        const runFrameAction = async (action: () => Promise<void>): Promise<void> => {
            if (isFrameActionInProgress) {
                return;
            }
            applyUncommitted();
            isFrameActionInProgress = true;
            const previousToolspacePointerEvents = this.toolspace.style.pointerEvents;
            this.toolspace.style.pointerEvents = 'none';
            this.easel.setIsFrozen(true);
            framesUi?.setBusy(true);
            try {
                await action();
            } catch (error) {
                showError(error instanceof Error ? error.message : LANG('frames-limit-reached'));
            } finally {
                isFrameActionInProgress = false;
                this.toolspace.style.pointerEvents = previousToolspacePointerEvents;
                this.easel.setIsFrozen(KL.DIALOG_COUNTER.get() > 0);
                framesUi?.setBusy(false);
                updateFramesUi();
                void refreshFrameOverlays();
            }
        };

        const addBlankFrame = async (): Promise<void> => {
            if (!activeFrameState) {
                const original = await captureCurrentFrame(randomUuid());
                if (!original) return;
                const blankId = randomUuid();
                const blankLayerId = randomUuid();
                const candidate = createFrameSet({
                    width: this.klCanvas.getWidth(),
                    height: this.klCanvas.getHeight(),
                    frames: [
                        original,
                        {
                            id: blankId,
                            layers: [{ id: blankLayerId, image: undefined }],
                        },
                    ],
                });
                if (!candidate.ok) {
                    showFrameLimitError();
                    return;
                }
                const blank = await createBlankFrame(blankId, blankLayerId);
                const result = createFrameSet({
                    width: candidate.value.width,
                    height: candidate.value.height,
                    frames: [original, blank],
                });
                if (!result.ok) {
                    showFrameLimitError();
                    return;
                }
                activeFrameState = { frameSet: result.value, activeFrameIndex: 1 };
                await restoreFrame(blank);
                return;
            }
            if (!(await updateActiveFrameFromCanvas())) return;
            const blankId = randomUuid();
            const blankLayerId = randomUuid();
            const candidate = addFrame(activeFrameState!, {
                id: blankId,
                layers: [{ id: blankLayerId, image: undefined }],
            });
            if (!candidate.ok) {
                showFrameLimitError();
                return;
            }
            const blank = await createBlankFrame(blankId, blankLayerId);
            const result = addFrame(activeFrameState!, blank);
            if (!result.ok) {
                showFrameLimitError();
                return;
            }
            activeFrameState = result.value;
            await restoreFrame(blank);
        };

        const duplicateActiveFrame = async (): Promise<void> => {
            if (!activeFrameState || !(await updateActiveFrameFromCanvas())) return;
            const source = activeFrameState.frameSet.frames[activeFrameState.activeFrameIndex];
            const result = duplicateFrame(
                activeFrameState,
                randomUuid(),
                source.layers.map(() => randomUuid()),
            );
            if (!result.ok) {
                showFrameLimitError();
                return;
            }
            activeFrameState = result.value;
            await restoreFrame(activeFrameState.frameSet.frames[activeFrameState.activeFrameIndex]);
        };

        const deleteActiveFrame = async (): Promise<void> => {
            if (!activeFrameState || !(await updateActiveFrameFromCanvas())) return;
            const result = deleteFrame(activeFrameState, activeFrameState.activeFrameIndex);
            if (!result.ok) {
                showFrameLimitError();
                return;
            }
            activeFrameState = result.value;
            await restoreFrame(activeFrameState.frameSet.frames[activeFrameState.activeFrameIndex]);
        };

        const moveActiveFrame = async (direction: -1 | 1): Promise<void> => {
            if (!activeFrameState || !(await updateActiveFrameFromCanvas())) return;
            const result = moveFrame(activeFrameState, activeFrameState.activeFrameIndex, direction);
            if (!result.ok) return;
            activeFrameState = result.value;
            updateFramesUi();
        };

        const selectActiveFrame = async (index: number): Promise<void> => {
            if (!activeFrameState || index === activeFrameState.activeFrameIndex) return;
            if (!(await updateActiveFrameFromCanvas())) return;
            const result = selectFrame(activeFrameState, index);
            if (!result.ok) return;
            activeFrameState = result.value;
            await restoreFrame(activeFrameState.frameSet.frames[index]);
        };

        const brushDiv = BB.el();
        const colorDiv = BB.el({
            css: {
                margin: 10,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
            },
        });
        paletteUi = new ProjectPaletteUi({
            onChange: (palette) => { this.projectPalette = palette; },
            onSetPrimary: (color) => setBrushColor(new BB.RGB(color.r, color.g, color.b)),
            getPrimary: () => ({ r: currentColor.r, g: currentColor.g, b: currentColor.b }),
            onExtract: () => {
                const canvas = this.klCanvas.getCanvas();
                try {
                    const data = BB.ctx(canvas, { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
                    return extractPaletteFromRgba(data, canvas.width, canvas.height);
                } finally {
                    BB.freeCanvas(canvas);
                }
            },
        });
        paletteUi.setPalette(this.projectPalette);
        paletteUi.setCurrentPrimaryColor(currentColor);
        const toolspaceStabilizerRow = new KL.ToolspaceStabilizerRow({
            smoothing: 1,
            onSelect: (v) => {
                lineSmoothing.setSmoothing(translateSmoothing(v));
            },
        });

        brushDiv.append(colorDiv);
        BB.append(colorDiv, [
            paletteUi.getElement(),
            this.klColorSlider.getElement(),
            this.klColorSlider.getOutputElement(),
            toolspaceStabilizerRow.getElement(),
        ]);

        const brushTabRow = new KL.TabRow({
            initialId: 'penBrush',
            useAccent: true,
            tabArr: (() => {
                const commonStyle: TCss = {
                    height: 28,
                    width: 28,
                    color: 'var(--ui-on-bg-full-contrast)',
                };
                const createTab = (keyStr: TBrushId) => {
                    const im = KL.BRUSHES_UI[keyStr].image;
                    css(im, commonStyle);
                    return {
                        id: keyStr,
                        label: BB.el({
                            content: im,
                            css: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                            },
                        }),
                        title: KL.BRUSHES_UI[keyStr].tooltip,
                        onOpen: () => {
                            brushUiMap[keyStr].getElement().style.display = 'block';
                            setCurrentBrush(keyStr);
                            this.klColorSlider.setIsEyedropping(false);
                            this.mobileColorUi.setIsEyedropping(false);
                            brushSettingService.emitSliderConfig({
                                sizeSlider: KL.BRUSHES_UI[keyStr].sizeSlider,
                                opacitySlider: KL.BRUSHES_UI[keyStr].opacitySlider,
                            });
                            sizeWatcher(brushUiMap[keyStr].getSize());
                            brushSettingService.emitOpacity(brushUiMap[keyStr].getOpacity());
                            this.mobileToolUi.update();
                        },
                        onClose: () => {
                            brushUiMap[keyStr].getElement().style.display = 'none';
                        },
                    };
                };

                return (Object.keys(KL.BRUSHES_UI) as TBrushId[]).map(createTab);
            })(),
        });
        BB.append(brushDiv, [
            brushTabRow.getElement(),
            ...Object.entries(KL.BRUSHES_UI).map(([b]) => brushUiMap[b].getElement()),
        ]);

        const handUi = new KL.HandUi({
            scale: this.easel.getTransform().scale,
            angleDeg: 0,
            onReset: () => {
                this.easel.resetTransform();
            },
            onFit: () => {
                this.easel.fitTransform();
            },
            onAngleChange: (angleDeg, isRelative) => {
                this.easel.setAngleDeg(angleDeg, isRelative);
            },
            onChangeIsMirrored: (b) => {
                this.easel.setIsMirrored(b);
            },
            onChangeUseInertiaScrolling: (b) => {
                easelHand.setUseInertiaScrolling(b);
            },
        });

        const fillUi = new KL.FillUi({
            colorSlider: this.klColorSlider,
        });

        const gradientUi = new KL.GradientUi({
            colorSlider: this.klColorSlider,
        });

        const textUi = new KL.TextUi({
            colorSlider: this.klColorSlider,
        });

        const shapeUi = new KL.ShapeUi({
            colorSlider: this.klColorSlider,
            onChangePanning: (doPan) => easelShape.setPanning(doPan),
        });

        const gradientTool = new KL.GradientTool({
            onGradient: (isDone, x1, y1, x2, y2, angleRad) => {
                const layerIndex = currentLayerIndex;
                const settings = gradientUi.getSettings();
                const gradientObj: TGradient = {
                    type: settings.type,
                    color1: this.klColorSlider.getColor(),
                    isReversed: settings.isReversed,
                    opacity: settings.opacity,
                    doLockAlpha: settings.doLockAlpha,
                    isEraser: settings.isEraser,
                    doSnap: keyListener.isPressed('shift') || settings.doSnap,
                    x1,
                    y1,
                    x2,
                    y2,
                    angleRad,
                };

                if (isDone) {
                    this.klCanvas.setComposite(layerIndex, undefined);
                    this.klCanvas.drawGradient(layerIndex, gradientObj);
                } else {
                    const selection = this.klCanvas.getSelection();
                    const selectionPath = selection
                        ? new Path2D(getSelectionPath2d(selection))
                        : undefined;
                    this.klCanvas.setComposite(layerIndex, {
                        draw: (ctx) => {
                            KL.drawGradient(ctx, gradientObj, selectionPath);
                        },
                    });
                }

                this.easelProjectUpdater.update();
            },
        });

        const shapeTool = new KL.ShapeTool({
            onShape: (isDone, x1, y1, x2, y2, angleRad) => {
                const layerIndex = currentLayerIndex;

                const shapeObj: any = {
                    type: shapeUi.getShape(),
                    x1: x1,
                    y1: y1,
                    x2: x2,
                    y2: y2,
                    angleRad: angleRad,
                    isOutwards: shapeUi.getIsOutwards(),
                    opacity: shapeUi.getOpacity(),
                    isEraser: shapeUi.getIsEraser(),
                    doLockAlpha: shapeUi.getDoLockAlpha(),
                };
                if (shapeUi.getShape() === 'line') {
                    shapeObj.strokeRgb = this.klColorSlider.getColor();
                    shapeObj.lineWidth = shapeUi.getLineWidth();
                    shapeObj.isAngleSnap = shapeUi.getIsSnap() || keyListener.isPressed('shift');
                } else {
                    shapeObj.isFixedRatio = shapeUi.getIsFixed() || keyListener.isPressed('shift');
                    if (shapeUi.getMode() === 'stroke') {
                        shapeObj.strokeRgb = this.klColorSlider.getColor();
                        shapeObj.lineWidth = shapeUi.getLineWidth();
                    } else {
                        shapeObj.fillRgb = this.klColorSlider.getColor();
                    }
                }

                if (isDone) {
                    this.klCanvas.setComposite(layerIndex, undefined);
                    this.klCanvas.drawShape(layerIndex, shapeObj);
                } else {
                    const selection = this.klCanvas.getSelection();
                    const selectionPath = selection
                        ? new Path2D(getSelectionPath2d(selection))
                        : undefined;
                    this.klCanvas.setComposite(layerIndex, {
                        draw: (ctx) => {
                            KL.drawShape(ctx, shapeObj, selectionPath);
                        },
                    });
                }

                this.easelProjectUpdater.update();
            },
        });

        this.floatingLayerPreview = new FloatingLayerPreview();
        this.layersUi = new KL.LayersUi({
            klCanvas: this.klCanvas,
            onSelect: (layerIndex, pushHistory) => {
                setCurrentLayer(layerIndex);

                if (pushHistory) {
                    const topEntry = this.klHistory.getEntries().at(-1)!.data;
                    const replaceTop = isHistoryEntryActiveLayerChange(topEntry);

                    this.klHistory.push(
                        {
                            activeLayerId: this.klCanvas.getLayer(layerIndex).id,
                        },
                        replaceTop,
                    );
                }
            },
            parentEl: this.rootEl,
            floatingLayerPreview: this.floatingLayerPreview,
            applyUncommitted: () => applyUncommitted(),
            klHistory: this.klHistory,
            onUpdateProject: () => this.easelProjectUpdater.update(),
            onClearLayer: () => clearLayer(false, true),
        });
        framesUi = new FramesUi({
            onAdd: () => runFrameAction(addBlankFrame),
            onDuplicate: () => runFrameAction(duplicateActiveFrame),
            onDelete: () => runFrameAction(deleteActiveFrame),
            onMoveLeft: () => runFrameAction(() => moveActiveFrame(-1)),
            onMoveRight: () => runFrameAction(() => moveActiveFrame(1)),
            onSelect: (index) => runFrameAction(() => selectActiveFrame(index)),
            onSetReference: () => runFrameAction(setCurrentFrameReference),
            onToggleOriginal: (show) => {
                showOriginal = show;
                void refreshFrameOverlays();
            },
            onToggleOnion: (show) => {
                showOnionSkin = show;
                void refreshFrameOverlays();
            },
            onOpacityChange: (opacity) => {
                overlayOpacity = opacity;
                void refreshFrameOverlays();
            },
            onCopyOriginal: () => runFrameAction(() => copyReferenceToCurrentLayer(false)),
            onCopySelection: () => runFrameAction(() => copyReferenceToCurrentLayer(true)),
        });
        updateFramesUi();
        framesUi.setIsVisible(false);
        this.klHistory.addListener(() => {
            framesUi?.updateSelectionAvailability(!!this.klCanvas.getSelection()?.length);
            if (!activeFrameState) {
                if (frameThumbnailRefreshTimeout !== undefined) {
                    clearTimeout(frameThumbnailRefreshTimeout);
                    frameThumbnailRefreshTimeout = undefined;
                }
                return;
            }
            if (frameThumbnailRefreshTimeout !== undefined) {
                clearTimeout(frameThumbnailRefreshTimeout);
            }
            frameThumbnailRefreshTimeout = setTimeout(() => {
                frameThumbnailRefreshTimeout = undefined;
                if (!activeFrameState) return;
                const activeFrame =
                    activeFrameState.frameSet.frames[activeFrameState.activeFrameIndex];
                if (!activeFrame) return;
                const thumbnail = createFrameThumbnail();
                framesUi.updateActiveThumbnail(thumbnail);
            }, 400);
        });
        this.layerPreview = new KL.LayerPreview({
            klRootEl: this.rootEl,
            onClick: () => {
                mainTabRow?.open('layers');
            },
            floatingLayerPreview: this.floatingLayerPreview,
            klHistory: this.klHistory,
            klCanvas: this.klCanvas,
        });
        const toolspaceLayout = getToolspaceLayout(this.uiHeight);
        this.layerPreview.setIsVisible(toolspaceLayout.isLayerPreviewVisible);
        this.layerPreview.setIsSmall(toolspaceLayout.isLayerPreviewSmall);

        const editUi = new KL.EditUi({
            klRootEl: this.rootEl,
            klColorSlider: this.klColorSlider,
            layersUi: this.layersUi,
            getCurrentColor: () => currentColor,
            maxCanvasSize,
            klCanvas: this.klCanvas,
            getCurrentLayerIndex: () => currentLayerIndex,
            isEmbed: !!this.embed,
            statusOverlay: this.statusOverlay,
            onCanvasChanged: () => {
                this.easelProjectUpdater.update();
                this.easel.resetOrFitTransform(true);
            },
            applyUncommitted: () => applyUncommitted(),
            klHistory: this.klHistory,
            onCopyToClipboard: () => {
                applyUncommitted();
                copyToClipboard(false, false);
            },
            onPaste: () => importHandler.readClipboard(),
        });

        const klHistoryExecutor = new KlHistoryExecutor({
            klHistory: this.klHistory,
            tempHistory,
            onCanUndoRedoChange: (canUndo, canRedo) => {
                this.toolspaceToolRow.updateUndoRedo(canUndo, canRedo);
                this.mobileUi.updateUndoRedo(canUndo, canRedo);
            },
        });

        const showNewImageDialog = () => {
            applyUncommitted();
            KL.newImageDialog({
                currentColor: currentColor,
                secondaryColor: this.klColorSlider.getSecondaryRGB(),
                maxCanvasSize,
                canvasWidth: this.klCanvas.getWidth(),
                canvasHeight: this.klCanvas.getHeight(),
                workspaceWidth:
                    window.innerWidth < this.collapseThreshold
                        ? this.uiWidth
                        : this.uiWidth - this.toolWidth,
                workspaceHeight: this.uiHeight,
                onConfirm: (width, height, color) => {
                    this.klCanvas.reset({
                        projectId: randomUuid(),
                        width: width,
                        height: height,
                        color: color.a === 1 ? color : undefined,
                    });
                    activeFrameState = undefined;
                    updateFramesUi();

                    this.layersUi.update(0);
                    setCurrentLayer(0);
                    this.easelProjectUpdater.update();
                    this.easel.resetOrFitTransform(true);
                    void refreshFrameOverlays();
                    refreshServerProjectHeader();
                },
                onCancel: () => {},
            });
        };

        const shareImage = (callback?: () => void) => {
            applyUncommitted();
            BB.shareCanvas({
                canvas: this.klCanvas.getCanvas(),
                fileName: getFilenameDate() + KL_CONFIG.filenameBase + '.png',
                title: getFilenameDate() + KL_CONFIG.filenameBase + '.png',
                callback: callback ? callback : () => {},
            });
        };

        this.saveToComputer = new KL.SaveToComputer(
            () => exportType,
            this.klCanvas,
            () => {
                this.updateLastSaved();
            },
        );

        const copyToClipboard = (showCrop: boolean = false, closeOnBlur: boolean = true) => {
            KL.clipboardDialog(
                this.rootEl,
                (maskSelection) => {
                    return this.klCanvas.getCanvas(1, maskSelection);
                },
                (inputObj) => {
                    if (
                        inputObj.left === 0 &&
                        inputObj.right === 0 &&
                        inputObj.top === 0 &&
                        inputObj.bottom === 0
                    ) {
                        return;
                    }
                    //do a crop
                    KL.FILTER_LIB.cropExtend.apply!({
                        layer: this.klCanvas.getLayer(currentLayerIndex),
                        klCanvas: this.klCanvas,
                        input: inputObj,
                        klHistory: this.klHistory,
                    });
                    this.layersUi.update();
                    this.easelProjectUpdater.update();
                    this.easel.resetOrFitTransform(true);
                },
                this.statusOverlay,
                showCrop || false,
                closeOnBlur,
                this.klCanvas.getSelection(),
            );
        };

        const restoreStoredProject = async (project: TDeserializedKlStorageProject): Promise<boolean> => {
            applyUncommitted();
            const layerIndex = this.klCanvas.reset({
                projectId: project.project.projectId,
                width: project.project.width,
                height: project.project.height,
                layers: project.project.layers.map((item) => {
                    let image = item.image;
                    if (!(image instanceof HTMLCanvasElement)) {
                        image = BB.canvas(project.project.width, project.project.height);
                        if (item.image instanceof HTMLImageElement) BB.ctx(image).drawImage(item.image, 0, 0);
                    }
                    return { ...item, id: randomUuid(), image };
                }),
            });
            if (layerIndex === false) return false;
            if (project.project.frames) {
                const { activeFrameIndex, ...frameSetData } = project.project.frames;
                const validated = createFrameSet({ ...frameSetData, referenceTrack: project.project.referenceTrack });
                if (!validated.ok || !Number.isInteger(activeFrameIndex) || activeFrameIndex < 0 || activeFrameIndex >= validated.value.frames.length) {
                    activeFrameState = undefined;
                    return false;
                }
                activeFrameState = { frameSet: validated.value, activeFrameIndex };
                updateFramesUi();
                if (!(await restoreFrame(activeFrameState.frameSet.frames[activeFrameIndex]))) {
                    activeFrameState = undefined;
                    updateFramesUi();
                    return false;
                }
            } else {
                activeFrameState = undefined;
                updateFramesUi();
                this.layersUi.update(layerIndex);
                setCurrentLayer(layerIndex);
                this.easelProjectUpdater.update();
            }
            this.projectPalette = normalizePalette(project.project.palette);
            paletteUi.setPalette(this.projectPalette);
            await refreshFrameOverlays();
            this.easel.resetOrFitTransform(true);
            return true;
        };

        const onOpenServerProject = async (id: string) => {
            const hasUnsavedChanges = serverProjectDirty ||
                this.klHistory.getChangeCount() !== serverProjectCleanChangeCount;
            if (
                id !== this.klCanvas.getProject().projectId &&
                hasUnsavedChanges &&
                !window.confirm(LANG('server-projects-open-unsaved-confirm'))
            ) return;
            let closeLoader: (() => void) | undefined;
            showModal({ message: LANG('loading'), callback: () => { closeLoader = undefined; }, closeFunc: (f) => { closeLoader = f; } });
            try {
                const project = await remoteProjectStore.read(id);
                if (!project || !(await restoreStoredProject(project))) throw new Error('Unable to restore project');
                markServerProjectClean();
                this.statusOverlay.out(LANG('server-projects-restored'));
            } catch (error) {
                showError(LANG('file-storage-open-failed'));
                asyncThrow(error);
            } finally { closeLoader?.(); }
        };

        const onOpenBrowserStorage = async () => {
            const showFailureMessage = () => {
                showError(LANG('file-storage-open-failed'));
            };

            if (!projectStore) {
                showFailureMessage();
                return;
            }
            const meta = projectStore.getCurrentMeta();

            // Check is project already opened in other tab.
            // (if it's already open in the current tab, user showed intentionality. Don't ask again.)
            if (meta && this.klHistory.getComposed().projectId.value !== meta.projectId) {
                let doOpen = true;
                const crossTabChannel = new CrossTabChannel('kl-tab-communication');

                const openedProjectIds: string[] = [];
                const otherIdListener = (message: any) => {
                    if (message.type === 'response-project-id') {
                        openedProjectIds.push(message.id);
                    }
                };
                crossTabChannel.subscribe(otherIdListener);
                crossTabChannel.postMessage({ type: 'request-project-ids' });
                await sleep(100);
                crossTabChannel.unsubscribe(otherIdListener);

                if (meta && openedProjectIds.includes(meta.projectId)) {
                    doOpen = await new Promise<boolean>((resolve, reject) => {
                        showModal({
                            message: LANG('file-storage-open-confirmation'),
                            buttons: [{ id: 'open', label: LANG('file-storage-open') }, 'Cancel'],
                            callback: async (result) => {
                                if (result === 'Cancel') {
                                    resolve(false);
                                    return;
                                }
                                resolve(true);
                            },
                        });
                    });
                }

                crossTabChannel.close();
                if (!doOpen) {
                    return;
                }
            }

            let closeLoader: (() => void) | undefined;
            showModal({
                message: LANG('loading'),
                callback: (result) => {
                    closeLoader = undefined;
                },
                closeFunc: (f) => {
                    closeLoader = f;
                },
            });
            let project: TDeserializedKlStorageProject | undefined;
            try {
                project = await projectStore?.read();
            } catch (e) {
                asyncThrow(e);
            }
            if (!project) {
                closeLoader?.();
                showFailureMessage();
                return;
            }
            applyUncommitted();
            const layerIndex = this.klCanvas.reset({
                projectId: project.project.projectId,
                width: project.project.width,
                height: project.project.height,
                layers: project.project.layers.map((item) => {
                    let image = item.image;
                    if (!(image instanceof HTMLCanvasElement)) {
                        image = BB.canvas(project.project.width, project.project.height);
                        if (item.image instanceof HTMLImageElement) {
                            const ctx = BB.ctx(image);
                            ctx.drawImage(item.image, 0, 0);
                        }
                    }
                    return {
                        ...item,
                        id: randomUuid(),
                        image,
                    };
                }),
            });
            if (layerIndex === false) {
                closeLoader?.();
                showFailureMessage();
                return;
            }
            if (project.project.frames) {
                const { activeFrameIndex, ...frameSetData } = project.project.frames;
                const validated = createFrameSet({
                    ...frameSetData,
                    referenceTrack: project.project.referenceTrack,
                });
                if (
                    !validated.ok ||
                    !Number.isInteger(activeFrameIndex) ||
                    activeFrameIndex < 0 ||
                    activeFrameIndex >= validated.value.frames.length
                ) {
                    activeFrameState = undefined;
                    closeLoader?.();
                    showFailureMessage();
                    return;
                }
                activeFrameState = {
                    frameSet: validated.value,
                    activeFrameIndex,
                };
                updateFramesUi();
                const restoredFrame = await restoreFrame(
                    activeFrameState.frameSet.frames[activeFrameIndex],
                );
                if (!restoredFrame) {
                    activeFrameState = undefined;
                    updateFramesUi();
                    closeLoader?.();
                    showFailureMessage();
                    return;
                }
            } else {
                activeFrameState = undefined;
                updateFramesUi();
                this.layersUi.update(layerIndex);
                setCurrentLayer(layerIndex);
                this.easelProjectUpdater.update();
            }
            this.projectPalette = normalizePalette(project.project.palette);
            paletteUi.setPalette(this.projectPalette);
            await refreshFrameOverlays();
            this.easel.resetOrFitTransform(true);

            setTimeout(() => {
                // timeout to overwrite zoom overlay msg
                this.statusOverlay.out(LANG('file-storage-restored'));
            });
            closeLoader?.();
        };

        const importRnsImage = async (
            source: HTMLImageElement | HTMLCanvasElement,
            packageData?: TRnsPackageData,
        ): Promise<void> => {
            const sourceCanvas = BB.canvas(source.width, source.height);
            const sourceCtx = BB.ctx(sourceCanvas, { willReadFrequently: true });
            sourceCtx.drawImage(source, 0, 0);
            const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
            const occupiedColumns = new Uint8Array(source.width);
            for (let y = 0; y < source.height; y++) {
                for (let x = 0; x < source.width; x++) {
                    if (pixels[(y * source.width + x) * 4 + 3]) occupiedColumns[x] = 1;
                }
            }
            showRnsSpriteGeometryDialog({
                sheetWidth: source.width,
                sheetHeight: source.height,
                occupiedColumns,
                onCancel: () => BB.freeCanvas(sourceCanvas),
                onConfirm: async (geometry) => {
                    try {
                        const raw = new Uint8Array(pixels);
                        const split = sliceRgbaSpriteSheet(raw, geometry);
                        geometry.trailingPixels = split.trailingPixels;
                        const imported = buildRnsImportedFrameSet(split.frames, geometry, {
                            originalLayerName: LANG('frames-original-layer'),
                            editableLayerName: LANG('layers-layer') + ' 2',
                            makeId: randomUuid,
                            createImage: (pixels) => {
                                const canvas = BB.canvas(geometry.cellWidth, geometry.cellHeight);
                                BB.ctx(canvas).putImageData(
                                    new ImageData(new Uint8ClampedArray(pixels), geometry.cellWidth, geometry.cellHeight),
                                    0,
                                    0,
                                );
                                return canvas;
                            },
                            createBlankImage: () => BB.canvas(geometry.cellWidth, geometry.cellHeight),
                        });
                        if (!imported.ok) {
                            showError(imported.error.message);
                            return;
                        }
                        const frames = imported.value.frameSet.frames;
                        for (let index = 0; index < frames.length; index++) {
                            const frame = frames[index];
                            const originalCanvas = frame.layers[0].image as HTMLCanvasElement;
                            // The two-layer form's visible composite is initially transparent.
                            // Cache that composite for lossless frame assembly; the original cell
                            // remains available from the hidden layer and reference track.
                            framePixelCache.set(
                                frame.id,
                                imported.value.usedSingleLayerFallback
                                    ? split.frames[index].slice()
                                    : new Uint8Array(geometry.cellWidth * geometry.cellHeight * 4),
                            );
                            const thumbnailCanvas = BB.canvas(64, 64);
                            BB.ctx(thumbnailCanvas).drawImage(originalCanvas, 0, 0, 64, 64);
                            frame.thumbnail = thumbnailCanvas.toDataURL('image/png');
                            BB.freeCanvas(thumbnailCanvas);
                        }
                        const frameSetInput = {
                            ...imported.value.frameSet,
                            ...(packageData ? { rnsPackage: packageData } : {}),
                        };
                        const result = createFrameSet(frameSetInput);
                        if (!result.ok) {
                            showError(result.error.message);
                            return;
                        }
                        applyUncommitted();
                        activeFrameState = { frameSet: result.value, activeFrameIndex: imported.value.activeFrameIndex };
                        showOriginal = true;
                        showOnionSkin = false;
                        overlayOpacity = 0.35;
                        if (!(await restoreFrame(frames[imported.value.activeFrameIndex]))) {
                            activeFrameState = undefined;
                            showError(LANG('rns-import-failed'));
                            return;
                        }
                        updateFramesUi();
                        await refreshFrameOverlays();
                        if (imported.value.usedSingleLayerFallback) {
                            this.statusOverlay.out(LANG('rns-layer-memory-fallback'), true);
                        }
                        this.easel.resetOrFitTransform(true);
                    } catch (error) {
                        showError(error instanceof Error ? error.message : LANG('rns-import-failed'));
                    } finally {
                        BB.freeCanvas(sourceCanvas);
                    }
                },
            });
        };

        const importRnsSpriteFile = async (file: File): Promise<void> => {
            try {
                const image = await loadImageFromBlob(file);
                await importRnsImage(image);
            } catch (error) {
                showError(error instanceof Error ? error.message : LANG('rns-import-failed'));
            }
        };

        const importRnsPackageFiles = async (files: FileList): Promise<void> => {
            try {
                // Inputs are cleared immediately after the callback returns; FileList is live.
                const fileArr = Array.from(files);
                let packageFiles: TRnsPackageFiles;
                let packageName = 'R&S Mod';
                if (fileArr.length === 1 && fileArr[0].name.toLowerCase().endsWith('.zip')) {
                    packageFiles = await readZipFile(fileArr[0]);
                    packageName = fileArr[0].name.replace(/\.zip$/i, '');
                } else {
                    packageFiles = new Map();
                    for (const file of fileArr) {
                        const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
                        const normalized = normalizeRnsFolderPath(relative || file.name, file.name);
                        packageFiles.set(normalized, new Uint8Array(await file.arrayBuffer()));
                    }
                    const firstPath = packageFiles.keys().next().value as string | undefined;
                    packageName = firstPath ? rnsPackageNameFromPath(firstPath, packageName) : packageName;
                }
                for (const path of packageFiles.keys()) {
                    if (path.startsWith('/') || path.split('/').includes('..')) throw new Error('Unsafe path in Mods package');
                }
                const animations = listRnsAnimations(packageFiles);
                const resolvePath = (path: string): string | undefined =>
                    packageFiles.has(path) ? path : [...packageFiles.keys()].find((item) => item.endsWith('/' + path));
                const resolved = animations.flatMap((animation) => {
                    const highQualityPath = resolvePath(animation.highQualityPath);
                    const lowQualityPath = resolvePath(animation.lowQualityPath);
                    return highQualityPath && lowQualityPath
                        ? [{ ...animation, highQualityPath, lowQualityPath }]
                        : [];
                });
                if (!resolved.length) throw new Error('No animation rows with matching HQ and LQ files were found');
                const select = BB.el({ tagName: 'select', className: 'kl-input' }) as HTMLSelectElement;
                for (const item of resolved) {
                    const option = BB.el({ tagName: 'option', textContent: `${item.key} — ${item.highQualityPath}` }) as HTMLOptionElement;
                    option.value = item.key;
                    select.append(option);
                }
                showModal({
                    message: `<b>${LANG('rns-select-animation')}</b>`,
                    div: BB.el({ content: select }),
                    buttons: [{ id: 'select', label: LANG('rns-choose-sheet') }, 'Cancel'],
                    primaries: ['select'],
                    callback: async (choice) => {
                        if (choice !== 'select') return;
                        const animation = resolved.find((item) => item.key === select.value)!;
                        const highQualityBytes = packageFiles.get(animation.highQualityPath)!;
                        const lowQualityBytes = packageFiles.get(animation.lowQualityPath)!;
                        const lowQualityDimensions = readPngDimensions(lowQualityBytes);
                        const filesRecord = Object.fromEntries([...packageFiles].map(([path, data]) => [path, data]));
                        const packageData: TRnsPackageData = {
                            packageName,
                            files: filesRecord,
                            animationKey: animation.key,
                            highQualityPath: animation.highQualityPath,
                            lowQualityPath: animation.lowQualityPath,
                            lowQualityWidth: lowQualityDimensions.width,
                            lowQualityHeight: lowQualityDimensions.height,
                        };
                        const image = await loadImageFromBlob(new Blob([copyToArrayBuffer(highQualityBytes)], { type: 'image/png' }));
                        await importRnsImage(image, packageData);
                    },
                });
            } catch (error) {
                showError(error instanceof Error ? error.message : LANG('rns-import-failed'));
            }
        };

        const getCurrentSpritePng = async (): Promise<{ blob: Blob; geometry: TFrameSheetGeometry; pixels: Uint8Array } | undefined> => {
            if (!activeFrameState) {
                showError(LANG('rns-needs-frames'));
                return;
            }
            if (!(await updateActiveFrameFromCanvas())) return;
            const frameSet = activeFrameState.frameSet;
            const geometry = frameSet.sheet ?? {
                cellWidth: frameSet.width,
                cellHeight: frameSet.height,
                frameCount: frameSet.frames.length,
                trailingPaddingPx: 0,
                sheetWidth: frameSet.width * frameSet.frames.length,
                sheetHeight: frameSet.height,
            };
            const cells: Uint8Array[] = [];
            for (const frame of frameSet.frames) {
                let pixels = framePixelCache.get(frame.id);
                if (!pixels) {
                    const composite = await createFrameComposite(frame);
                    pixels = new Uint8Array(BB.ctx(composite, { willReadFrequently: true }).getImageData(0, 0, frameSet.width, frameSet.height).data);
                    framePixelCache.set(frame.id, pixels);
                }
                cells.push(pixels);
            }
            const activePixels = framePixelCache.get(frameSet.frames[activeFrameState.activeFrameIndex].id);
            if (!activePixels) throw new Error('Active frame pixels are unavailable');
            const pixels = assembleRnsSpriteSheet(
                cells,
                geometry,
                geometry.trailingPixels,
                activeFrameState.activeFrameIndex,
                activePixels,
            );
            // Sheets like the supplied 16,828px strip exceed common 2D canvas
            // backing limits; canvas encoding also corrupts low-alpha pixels.
            const blob = await encodeRgbaPng(pixels, geometry.sheetWidth, geometry.sheetHeight);
            return { blob, geometry, pixels };
        };

        const exportRnsSprite = async (): Promise<void> => {
            try {
                const result = await getCurrentSpritePng();
                if (result) await saveAs('rabbit-and-steel-sprite.png', 'image/png', async () => result.blob);
            } catch (error) {
                showError(error instanceof Error ? error.message : LANG('rns-export-failed'));
            }
        };

        const exportAnimatedGif = async (request: TGifExportRequest): Promise<void> => {
            if (!activeFrameState) return;
            const progress = showGifProgressDialog();
            let worker: Worker | undefined;
            try {
                applyUncommitted();
                if (!(await updateActiveFrameFromCanvas())) return;
                const frameSet = activeFrameState.frameSet;
                const selected = selectGifFrameRange(frameSet.frames, request.from, request.to);
                const frames: TRgbaFrame[] = [];
                for (let index = 0; index < selected.length; index++) {
                    if (progress.isCancelled()) return;
                    const frame = selected[index];
                    let pixels = framePixelCache.get(frame.id);
                    if (!pixels) {
                        const composite = await createFrameComposite(frame);
                        pixels = new Uint8Array(
                            BB.ctx(composite, { willReadFrequently: true })
                                .getImageData(0, 0, frameSet.width, frameSet.height).data,
                        );
                    }
                    frames.push({ width: frameSet.width, height: frameSet.height, pixels: pixels.slice() });
                    progress.update((index + 1) / selected.length * 0.15);
                }
                if (progress.isCancelled()) return;
                worker = new Worker(new URL('../klecks/frames/gif-export.worker.ts', import.meta.url), { type: 'module' });
                const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
                    worker!.onmessage = (event: MessageEvent) => {
                        if (event.data.type === 'progress') {
                            progress.update(0.15 + Number(event.data.progress) * 0.85);
                        } else if (event.data.type === 'done') {
                            resolve(event.data.bytes as ArrayBuffer);
                        } else if (event.data.type === 'error') {
                            reject(new Error(event.data.message));
                        }
                        if (progress.isCancelled()) {
                            worker?.terminate();
                            reject(new DOMException('GIF export cancelled', 'AbortError'));
                        }
                    };
                    worker!.onerror = (event) => reject(new Error(event.message || LANG('gif-export-failed')));
                    worker!.postMessage(
                        { frames, options: request },
                        frames.map((frame) => frame.pixels.buffer as ArrayBuffer),
                    );
                });
                progress.close();
                await saveAs(
                    `${KL_CONFIG.filenameBase || 'klecks'}.gif`,
                    'image/gif',
                    async () => new Blob([bytes], { type: 'image/gif' }),
                );
            } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    const message = error instanceof Error ? error.message : LANG('gif-export-failed');
                    showError(`${LANG('gif-export-error-prefix')}: ${message}`);
                }
            } finally {
                worker?.terminate();
                progress.close();
            }
        };

        const exportRnsPackage = async (): Promise<void> => {
            try {
                const result = await getCurrentSpritePng();
                const packageData = activeFrameState?.frameSet.rnsPackage;
                if (!result || !packageData) {
                    showError(LANG('rns-needs-package'));
                    return;
                }
                const lowQualityPixels = scaleRgbaNearest(
                    result.pixels,
                    result.geometry.sheetWidth,
                    result.geometry.sheetHeight,
                    packageData.lowQualityWidth,
                    packageData.lowQualityHeight,
                );
                const lowCanvas = BB.canvas(packageData.lowQualityWidth, packageData.lowQualityHeight);
                BB.ctx(lowCanvas).putImageData(new ImageData(new Uint8ClampedArray(lowQualityPixels), packageData.lowQualityWidth, packageData.lowQualityHeight), 0, 0);
                const lowBlob = await canvasToBlob(lowCanvas, 'image/png');
                BB.freeCanvas(lowCanvas);
                const [hqBytes, lqBytes] = await Promise.all([
                    result.blob.arrayBuffer().then((array) => new Uint8Array(array)),
                    lowBlob.arrayBuffer().then((array) => new Uint8Array(array)),
                ]);
                const originalFiles = new Map(Object.entries(packageData.files));
                const edited = applyRnsPackageEdits(originalFiles, packageData.highQualityPath, hqBytes, packageData.lowQualityPath, lqBytes);
                const zip = writeStoredZip(edited);
                await saveAs(`${packageData.packageName}-edited.zip`, 'application/zip', async () => new Blob([copyToArrayBuffer(zip)], { type: 'application/zip' }));
            } catch (error) {
                showError(error instanceof Error ? error.message : LANG('rns-export-failed'));
            }
        };

        const fileUi = this.embed
            ? null
            : new KL.FileUi({
                  klRootEl: this.rootEl,
                  helpPath: this.helpPath,
                  projectStore: projectStore,
                  remoteProjectStore,
                  getProject: () => this.getProject(),
                  exportType: exportType,
                  onExportTypeChange: (type) => {
                      exportType = type;
                  },
                  onFileSelect: (files, optionsStr) =>
                      importHandler.handleFileSelect(files, optionsStr),
                  onSaveImageToComputer: () => {
                      applyUncommitted();
                      this.saveToComputer.save();
                  },
                  onImportRnsSprite: (file) => void importRnsSpriteFile(file),
                  onImportRnsPackage: (files) => void importRnsPackageFiles(files),
                  onExportRnsSprite: () => void exportRnsSprite(),
                  onExportRnsPackage: () => void exportRnsPackage(),
                  onExportGif: () => {
                      const frameSet = this.getActiveFrameState?.()?.frameSet;
                      if (frameSet) showGifExportDialog(frameSet.frames.length, (request) => void exportAnimatedGif(request));
                  },
                  isFrameSetAvailable: () => !!this.getActiveFrameState?.(),
                  onNewImage: showNewImageDialog,
                  onShareImage: (callback) => {
                      applyUncommitted();
                      shareImage(callback);
                  },
                  onUpload: () => {
                      // on upload
                      applyUncommitted();
                      KL.imgurUpload(
                          this.klCanvas,
                          p.app && p.app.imgurKey ? p.app.imgurKey : '',
                          () => this.updateLastSaved(),
                      );
                  },
                  applyUncommitted: () => applyUncommitted(),
                  onChangeShowSaveDialog: (b) => {
                      this.saveToComputer.setShowsSaveDialog(b);
                  },
                  klRecoveryManager,
                  onOpenBrowserStorage,
                  onOpenServerProject,
                  onSetServerProjectId: (id) => this.klCanvas.setProjectId(id),
                  onServerProjectSaved: (name) => {
                      markServerProjectClean();
                      this.statusOverlay.out(`${LANG('server-projects-saved')} ${name}`);
                  },
                  onStoredToBrowserStorage: () => {
                      this.updateLastSaved();
                  },
              });
        refreshServerProjectHeader = () => fileUi?.refreshServerProjectBinding();
        refreshGifExportAvailability = () => fileUi?.refresh();

        if (!this.embed && projectStore) {
            this.saveReminder = new SaveReminder({
                onSaveAsPsd: () => {
                    if (!this.embed) {
                        this.saveAsPsd();
                    }
                },
                isDrawing: () => {
                    return this.isDrawing();
                },
                projectStore,
                getProject: () => this.getProject(),
                onStored: () => {
                    this.updateLastSaved();
                },
                applyUncommitted,
                klHistory: this.klHistory,
                helpPath: this.helpPath,
            });
        }

        const settingsUi = new KL.SettingsUi({
            onLeftRight: () => {
                this.uiLayout = this.uiLayout === 'left' ? 'right' : 'left';
                this.updateUi();
                if (!this.embed) {
                    LocalStorage.setItem('uiState', this.uiLayout);
                }
            },
            saveReminder: this.saveReminder,
            customAbout: p.aboutEl,
        });

        mainTabRow = new KL.TabRow({
            initialId: 'brush',
            tabArr: [
                {
                    id: 'brush',
                    title: LANG('tool-brush'),
                    image: toolPaintImg,
                    onOpen: () => {
                        if (currentBrushId === 'eraserBrush') {
                            this.klColorSlider.enable(false);
                        }
                        BB.append(colorDiv, [
                            this.klColorSlider.getElement(),
                            this.klColorSlider.getOutputElement(),
                            toolspaceStabilizerRow.getElement(),
                        ]);
                        brushDiv.style.display = 'block';
                    },
                    onClose: () => {
                        brushDiv.style.display = 'none';
                    },
                    css: {
                        minWidth: 45,
                    },
                },
                {
                    id: 'hand',
                    title: LANG('tool-hand'),
                    image: toolHandImg,
                    isVisible: false,
                    onOpen: () => {
                        handUi.setIsVisible(true);
                    },
                    onClose: () => {
                        handUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: 45,
                    },
                },
                {
                    id: 'paintBucket',
                    title: LANG('tool-paint-bucket'),
                    image: toolFillImg,
                    isVisible: false,
                    onOpen: () => {
                        this.klColorSlider.enable(true);
                        fillUi.setIsVisible(true);
                    },
                    onClose: () => {
                        fillUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: 45,
                    },
                },
                {
                    id: 'gradient',
                    title: LANG('tool-gradient'),
                    image: toolGradientImg,
                    isVisible: false,
                    onOpen: () => {
                        this.klColorSlider.enable(true);
                        gradientUi.setIsVisible(true);
                    },
                    onClose: () => {
                        gradientUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: 45,
                    },
                },
                {
                    id: 'text',
                    title: LANG('tool-text'),
                    image: toolTextImg,
                    isVisible: false,
                    onOpen: () => {
                        this.klColorSlider.enable(true);
                        textUi.setIsVisible(true);
                    },
                    onClose: () => {
                        textUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: 45,
                    },
                },
                {
                    id: 'shape',
                    title: LANG('tool-shape'),
                    image: toolShapeImg,
                    isVisible: false,
                    onOpen: () => {
                        this.klColorSlider.enable(true);
                        shapeUi.setIsVisible(true);
                    },
                    onClose: () => {
                        shapeUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: 45,
                    },
                },
                {
                    id: 'select',
                    title: LANG('tool-select'),
                    image: toolSelectImg,
                    isVisible: false,
                    onOpen: () => {
                        klAppSelect.getSelectUi().setIsVisible(true);
                    },
                    onClose: () => {
                        klAppSelect.getSelectUi().setIsVisible(false);
                    },
                    css: {
                        minWidth: 45,
                    },
                },
                {
                    id: 'layers',
                    title: LANG('layers'),
                    image: tabLayersImg,
                    onOpen: () => {
                        this.layersUi.setIsVisible(true);
                        this.layersUi.update();
                    },
                    onClose: () => {
                        this.layersUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: 45,
                    },
                },
                {
                    id: 'frames',
                    image: tabFramesImg,
                    title: LANG('tab-frames'),
                    onOpen: () => {
                        framesUi?.setIsVisible(true);
                        updateFramesUi();
                    },
                    onClose: () => {
                        framesUi?.setIsVisible(false);
                    },
                    css: {
                        minWidth: 45,
                    },
                },
                {
                    id: 'edit',
                    title: LANG('tab-edit'),
                    image: tabEditImg,
                    onOpen: () => {
                        editUi.show();
                    },
                    onClose: () => {
                        editUi.hide();
                    },
                    css: {
                        minWidth: 45,
                    },
                },
                {
                    id: 'file',
                    label: LANG('tab-file'),
                    isVisible: !!fileUi,
                    onOpen: () => {
                        if (!fileUi) {
                            return;
                        }
                        fileUi.getElement().style.display = 'block';
                        fileUi.setIsVisible(true);
                    },
                    onClose: () => {
                        if (!fileUi) {
                            return;
                        }
                        fileUi.getElement().style.display = 'none';
                        fileUi.setIsVisible(false);
                    },
                    css: {
                        padding: '0 7px',
                    },
                },
                {
                    id: 'settings',
                    title: LANG('tab-settings'),
                    image: tabSettingsImg,
                    onOpen: () => {
                        settingsUi.getElement().style.display = 'block';
                        // settingsTab.setIsVisible(true);
                    },
                    onClose: () => {
                        settingsUi.getElement().style.display = 'none';
                        // settingsTab.setIsVisible(false);
                    },
                    css: {
                        minWidth: 45,
                    },
                },
            ],
        });

        this.bottomBarWrapper = BB.el({
            css: {
                width: 270,
            },
        });
        if (p.bottomBar) {
            this.bottomBar = p.bottomBar;
            this.bottomBarWrapper.append(this.bottomBar);
        }

        BB.append(this.toolspaceInner, [
            this.layerPreview.getElement(),
            mainTabRow.getElement(),
            brushDiv,
            handUi.getElement(),
            fillUi.getElement(),
            gradientUi.getElement(),
            textUi.getElement(),
            shapeUi.getElement(),
            klAppSelect.getSelectUi().getElement(),
            this.layersUi.getElement(),
            framesUi.getElement(),
            editUi.getElement(),
            fileUi ? fileUi.getElement() : undefined,
            settingsUi.getElement(),
            BB.el({
                css: {
                    height: 10, // a bit of spacing at the bottom
                    flexGrow: 1,
                },
            }),
            this.bottomBarWrapper ? this.bottomBarWrapper : undefined,
        ]);

        if (!this.embed) {
            Object.defineProperty(window, 'KL', {
                value: createConsoleApi({
                    onDraw: (path: TVector2D[]): void => {
                        if (!path || path.length === 0) {
                            return;
                        }
                        path.forEach((p, index) => {
                            if (index === 0) {
                                currentBrushUi.startLine(p.x, p.y, 1);
                            } else {
                                currentBrushUi.goLine(p.x, p.y, 1);
                            }
                        });
                        currentBrushUi.endLine();
                    },
                }),
                writable: false,
            });
        }

        this.resize(this.uiWidth, this.uiHeight);
        this.updateUi();

        const importHandler = new KlAppImportHandler(
            {
                klRootEl: this.rootEl,
                maxCanvasSize,
                layersUi: this.layersUi,
                setCurrentLayer,
                klCanvas: this.klCanvas,
                onImportConfirm: () => {
                    this.easelProjectUpdater.update();
                    this.easel.resetOrFitTransform(true);
                },
                applyUncommitted: () => applyUncommitted(),
            },
            {
                onColor: (rgb) => brushSettingService.setColor(rgb),
            },
        );

        if (!this.embed || this.embed.enableImageDropperImport) {
            new KL.KlImageDropper({
                target: document.body,
                onDrop: (files, optionStr) => {
                    if (KL.DIALOG_COUNTER.get() > 0) {
                        return;
                    }
                    applyUncommitted();
                    importHandler.handleFileSelect(files, optionStr);
                },
                enabledTest: () => {
                    return KL.DIALOG_COUNTER.get() === 0;
                },
            });

            window.document.addEventListener(
                'paste',
                (e: ClipboardEvent) => importHandler.onPaste(e),
                false,
            );
        }

        this.unloadWarningTrigger = new UnloadWarningTrigger({
            klHistory: this.klHistory,
            getLastSavedHistoryIndex: () => this.lastSavedHistoryIndex,
        });

        {
            window.addEventListener('resize', () => {
                this.resize(window.innerWidth, window.innerHeight);
            });
            window.addEventListener('orientationchange', () => {
                this.resize(window.innerWidth, window.innerHeight);
            });
            // 2024-08: window.resize doesn't fire on iPad Safari when:
            // pinch zoomed page, then reload, and un-pinch-zoom page
            // therefor also listen to visualViewport.
            if ('visualViewport' in window && visualViewport !== null) {
                visualViewport.addEventListener('resize', () => {
                    this.resize(window.innerWidth, window.innerHeight);
                });
            }

            // iPad doesn't trigger 'resize' event when using text zoom, although it's resizing the window.
            // Workaround: place a div in the body that fills the window, and use a ResizeObserver
            const windowResizeWatcher = BB.el({
                parent: document.body,
                css: {
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    zIndex: '-1',
                    userSelect: 'none',
                },
            });
            try {
                // Not all browsers support ResizeObserver. Not critical though.
                const observer = new ResizeObserver(() =>
                    this.resize(window.innerWidth, window.innerHeight),
                );
                observer.observe(windowResizeWatcher);
            } catch (e) {
                windowResizeWatcher.remove();
            }

            // prevent ctrl scroll -> zooming page
            this.rootEl.addEventListener(
                'wheel',
                (event) => {
                    if (keyListener.isPressed('ctrl')) {
                        event.preventDefault();
                    }
                },
                { passive: false },
            );
            // prevents pinch zoom of page on macOS Safari
            const prevent = (e: Event) => {
                e.preventDefault();
            };
            window.addEventListener('gesturestart', prevent, { passive: false });
            window.addEventListener('gesturechange', prevent, { passive: false });
            window.addEventListener('gestureend', prevent, { passive: false });

            const pinchZoomWatcher = new PinchZoomWatcher();
        }

        if (!this.embed) {
            setTimeout(() => {
                runBrowserStorageBanner({
                    projectStore,
                    klRecoveryManager,
                    onOpenBrowserStorage,
                    klHistory: this.klHistory,
                });
            });
        }
        this.saveReminder?.init();
    }

    // -------- interface --------

    getElement(): HTMLElement {
        return this.rootEl;
    }

    resize(w: number, h: number): void {
        // iPad scrolls down when increasing text zoom
        if (window.scrollY > 0) {
            window.scrollTo(0, 0);
        }

        if (this.uiWidth === Math.max(0, w) && this.uiHeight === Math.max(0, h)) {
            return;
        }

        this.uiWidth = Math.max(0, w);
        this.uiHeight = Math.max(0, h);

        this.updateCollapse();

        const toolspaceLayout = getToolspaceLayout(this.uiHeight);
        this.layerPreview.setIsVisible(toolspaceLayout.isLayerPreviewVisible);
        this.layerPreview.setIsSmall(toolspaceLayout.isLayerPreviewSmall);
        this.klColorSlider.setHeight(toolspaceLayout.colorSliderHeight);
        this.toolspaceToolRow.setIsSmall(toolspaceLayout.isToolRowSmall);
    }

    out(msg: string): void {
        this.statusOverlay.out(msg);
    }

    async getPNG(): Promise<Blob> {
        return await canvasToBlob(this.klCanvas.getCanvas(), 'image/png');
    }

    getPSD = async (): Promise<Blob> => {
        return await klCanvasToPsdBlob(this.klCanvas, false);
    };

    getProject(): TKlProject {
        const project = this.klCanvas.getProject();
        const frameState = this.getActiveFrameState?.();
        if (!frameState) {
            return { ...project, palette: this.projectPalette };
        }
        const { referenceTrack, ...frameSet } = frameState.frameSet;
        const activeFrame = frameState.frameSet.frames[frameState.activeFrameIndex];
        const activeLayers = this.klCanvas.getLayers();
        const thumbnail = this.createActiveFrameThumbnail();
        const frames = frameState.frameSet.frames.map((frame, index) =>
            index === frameState.activeFrameIndex
                ? {
                      ...frame,
                      thumbnail,
                      layers: activeLayers.map((layer) => ({
                          id: layer.id,
                          name: layer.name,
                          isVisible: layer.isVisible,
                          opacity: layer.opacity,
                          mixModeStr: layer.mixModeStr,
                          hasClipping: layer.hasClipping,
                          image: layer.canvas,
                      })),
                  }
                : frame,
        );
        return {
            ...project,
            palette: this.projectPalette,
            frames: {
                ...frameSet,
                frames,
                activeFrameIndex: frameState.activeFrameIndex,
            },
            ...(referenceTrack ? { referenceTrack } : {}),
        };
    }

    private createActiveFrameThumbnail(): string {
        const factor = 64 / Math.max(this.klCanvas.getWidth(), this.klCanvas.getHeight());
        const thumbnailCanvas = drawProject(this.klCanvas.getProject(), factor, undefined, 'high');
        try {
            return thumbnailCanvas.toDataURL('image/png');
        } finally {
            BB.freeCanvas(thumbnailCanvas);
        }
    }

    swapUiLeftRight(): void {
        this.uiLayout = this.uiLayout === 'left' ? 'right' : 'left';
        if (!this.embed) {
            LocalStorage.setItem('uiState', this.uiLayout);
        }
        this.updateUi();
    }

    setLogo(logoImg: string, isPixelated?: boolean, keepOriginalColors?: boolean): void {
        if (this.toolspaceTopRow instanceof ToolspaceTopRow) {
            this.toolspaceTopRow.setLogo(logoImg, isPixelated, keepOriginalColors);
        }
    }

    saveAsPsd(): void {
        this.saveToComputer.save('psd');
    }

    isDrawing(): boolean {
        return this.lineSanitizer.getIsDrawing() || this.easel.getIsLocked();
    }
}
