// An action that notes when Svelte installs it and updates it, and with what.
export const calls = [];

// And the type of what it is handed, of a list's first item for a list.
const kind = (value) => (Array.isArray(value) ? `[${typeof value[0]}]` : typeof value);

export function typed(node, value) {
    calls.push(`mount:${kind(value)}`);

    return {
        update(next) {
            calls.push(`update:${kind(next)}`);
        }
    };
}

export function noted(node, value) {
    calls.push(`mount:${value}`);

    return {
        update(next) {
            calls.push(`update:${next}`);
        }
    };
}
