import { encodeGifFrames } from './gif-export';
import type { TRgbaFrame, TGifExportOptions } from './gif-export';

type TRequest = { frames: TRgbaFrame[]; options: TGifExportOptions };
const workerScope = self as unknown as {
    onmessage: ((event: MessageEvent<TRequest>) => void) | null;
    postMessage(message: unknown, transfer?: Transferable[]): void;
};

workerScope.onmessage = (event: MessageEvent<TRequest>) => {
    try {
        const bytes = encodeGifFrames(event.data.frames, event.data.options, (progress) => {
            workerScope.postMessage({ type: 'progress', progress });
        });
        const buffer = bytes.slice().buffer as ArrayBuffer;
        workerScope.postMessage({ type: 'done', bytes: buffer }, [buffer]);
    } catch (error) {
        workerScope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
};
