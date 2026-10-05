// A JavaScript module that writes its own exported binding.
export let counter = 0;

export function bump() {
    counter += 1;
}

export function reset() {
    counter = 0;
}
