// A JavaScript library on the other side of a Python call, in the two shapes
// that read something other than an argument's contents.
//
// A registry that recognises a listener by identity — which is every
// `removeEventListener`, `off`, `unsubscribe` and deduplicating registry there
// is — and a function that compares the two arguments it was handed.
const target = new EventTarget();

export const on = (fn) => target.addEventListener('ping', fn);
export const off = (fn) => target.removeEventListener('ping', fn);
export const ping = () => target.dispatchEvent(new Event('ping'));

// Writes through the first argument and reads through the second: two names for
// one Python list have to be two names for one array on this side.
export function alias(a, b) {
    a.push(1);

    return { same: a === b, observed: b.length };
}

// The control for that one: the same graph arriving inside a single argument,
// where the sharing was never lost.
export const aliasBundle = (pair) => alias(pair[0], pair[1]);
