// Two calls that note their order, for a template that reads them both.
export const seen = [];

export function first() {
    seen.push('first');
    return `first@${seen.length}`;
}

export function second() {
    seen.push('second');
    return `second@${seen.length}`;
}
