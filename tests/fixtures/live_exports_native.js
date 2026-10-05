// The witness of `live_exports.py`: a JavaScript module's `export let`.
export let counter = 0;

export function bump() {
    counter += 1;
}

export function reset() {
    counter = 0;
}

export function read() {
    return counter;
}
