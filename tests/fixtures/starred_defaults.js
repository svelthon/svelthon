// Rows of JavaScript's for `StarredDefaults.svelte`: a first element absent, as
// `undefined` and as a hole, or `null`, before the rest.
export function makeRow(kind) {
    if (kind === 'undefined') return [undefined, 'tail'];
    if (kind === 'hole') {
        const row = Array(2);
        row[1] = 'tail';
        return row;
    }
    if (kind === 'null') return [null, 'tail'];
    return ['value', 'tail'];
}

export const later = (kind) => Promise.resolve(makeRow(kind));
