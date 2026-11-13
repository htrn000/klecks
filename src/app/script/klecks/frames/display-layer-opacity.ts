/** Return the easel-only opacity for a frame layer; stored layer metadata stays untouched. */
export function getDisplayLayerOpacity(
    opacity: number,
    isActive: boolean,
    isFrameBase: boolean,
    otherLayerOpacity = 1,
    overlayOpacity = 1,
): number {
    if (isFrameBase) return overlayOpacity;
    if (isActive) return opacity;
    return opacity * otherLayerOpacity;
}
