// A JavaScript array of two elements whose first is a getter, which counts its
// reads or raises at the first, or a hole; and what the array is after.
let reads = 0;
let rows;

export function makeRows(kind) {
    reads = 0;
    rows = kind === 'hole' ? [, 43] : [42, 43];

    if (kind !== 'hole') {
        Object.defineProperty(rows, '0', {
            enumerable: true,
            configurable: true,
            get() {
                reads += 1;
                if (kind === 'raising') throw new Error('unread array element');
                return 42;
            }
        });
    }

    return rows;
}

export function after() {
    const first = Object.getOwnPropertyDescriptor(rows, '0');

    return { reads, first: first === undefined ? 'hole' : 'get' in first ? 'getter' : 'data', second: rows[1], length: rows.length };
}
