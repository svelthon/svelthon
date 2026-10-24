// An action that keeps the function it is handed, to call it later, by the
// key its element carries; and a binding's target that keeps the function it
// was made with, each time it is written.
import { SvelteMap } from 'svelte/reactivity';

export const saved = {};

export function keep(node, read) {
    saved[node.dataset.k] = read;
    return { destroy() {} };
}

const written = new SvelteMap();
export const writeSaved = {};

export function slot(key, read) {
    return {
        get value() {
            return written.get(key) ?? 'initial';
        },
        set value(next) {
            written.set(key, next);
            writeSaved[key] = read;
        }
    };
}
