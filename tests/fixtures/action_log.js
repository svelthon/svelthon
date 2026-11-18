// An action that notes when Svelte installs it and updates it, and with what.
export const calls = [];

export function noted(node, value) {
    calls.push(`mount:${value}`);

    return {
        update(next) {
            calls.push(`update:${next}`);
        }
    };
}
