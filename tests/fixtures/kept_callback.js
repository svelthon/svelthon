// A library that keeps the callback it is handed and calls it later, with no
// component around the call.
let kept;

export function keep(callback) {
    kept = callback;
}

export const call = () => kept();

export const held = () => kept;
