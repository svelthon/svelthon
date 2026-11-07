// The calls `SnippetRereads.svelte` and its witness make of `read`.
export const calls = [];

export function read(value) {
    calls.push(value);
    return `read${value}`;
}
