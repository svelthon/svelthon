// A JavaScript function a Python module reaches for through `__js__`. It has
// parameter names, but nothing at the boundary can read them: that is why a
// keyword call to one is refused rather than placed.
export function measure(width, height) {
    return `${width}x${height}`;
}
