import type { TFrame, TFrameLayer } from './frame-set.ts';

function detach(layer: TFrameLayer): TFrameLayer {
    const { role: _role, ...metadata } = layer;
    if (layer.role !== 'frame-base') return metadata;
    return {
        ...metadata,
        isVisible: true,
        opacity: 1,
        mixModeStr: 'source-over',
        hasClipping: false,
    };
}

/** Promote one layer to the frame's base, detaching an old base if present. */
export function assignBaseLayer(
    frame: TFrame,
    layerId: string,
    makeLayer: () => TFrameLayer | undefined,
): TFrame {
    const selected = frame.layers.find((layer) => layer.id === layerId);
    if (!selected || selected.role === 'frame-base') return frame;

    const otherLayers = frame.layers
        .filter((layer) => layer.id !== layerId)
        .map(detach);
    const layers: TFrameLayer[] = [{ ...selected, role: 'frame-base' }, ...otherLayers];
    if (!layers.some((layer) => layer.role !== 'frame-base')) {
        const editableLayer = makeLayer();
        if (editableLayer) layers.push(editableLayer);
    }
    return { ...frame, layers };
}

/** Make a base editable while retaining its index and image. */
export function detachBaseLayer(frame: TFrame): TFrame {
    return {
        ...frame,
        layers: frame.layers.map(detach),
    };
}
