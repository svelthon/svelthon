// The same sets in a JavaScript module: the witness of what an importer reads.
export const tags = new Set(['a']);
export const frozen = new Set([1, 2]);
export const box = { tags };

export function mutate() {
    tags.add('b');
}

export function seen() {
    return [...tags].sort();
}
