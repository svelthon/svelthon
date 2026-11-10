// Svelte's witness for plain_cache.py: a JavaScript module, which no component
// follows.
export const seen = {};

export function double(k) {
    seen[k] = true;
    return k * 2;
}

export function forget() {
    for (const key of Object.keys(seen)) delete seen[key];
}
