// A value outside Svelte's signals, which a click moves on: a snippet argument
// that reads it is read again only where Svelte reads it again.
let latest = 10;

export const reset = () => {
    latest = 10;
};

export const source = {
    get value() {
        return latest;
    }
};

export const advance = () => {
    latest += 10;
};

export const read = () => source.value;

// Moves the value on between two reads of one expression, and counts nothing.
export const step = () => {
    latest = 20;
    return 0;
};
