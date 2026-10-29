// A registry that knows its callbacks by reference, as `removeEventListener`
// and every `off` do.
export const registry = new Set();

export function hold(callback) {
    registry.add(callback);
}
