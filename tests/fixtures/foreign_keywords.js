// A JavaScript function a Python module reaches for through `__js__`. It has
// parameter names, but nothing at the boundary can read them: that is why a
// keyword call to one is refused rather than placed.
export function measure(width, height) {
    return `${width}x${height}`;
}

// **A witness that can see a wrong call.** `measure` cannot: it has two
// parameters and ignores a third all by itself, so an extra argument left in
// place by the boundary kept giving the right answer. These two say what they
// were actually handed.
export function counted(...args) {
    return args.length;
}

export function defaulted(first, second = 'default') {
    return typeof second;
}
