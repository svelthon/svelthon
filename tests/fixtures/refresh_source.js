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
