// What the held tags of `HeldWhere.svelte` and its witness read, in order.
export const reads = [];

export function choose() {
    reads.push('choose');
    return 'p';
}

export function shape(snippet, tag) {
    reads.push(typeof snippet);
    return tag;
}
