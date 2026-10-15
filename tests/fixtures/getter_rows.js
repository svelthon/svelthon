// A JavaScript array of one element held behind a getter, which counts its
// reads, or raises at the first.
let reads = 0;

export const read = () => reads;

export function makeRows(kind) {
    reads = 0;

    const rows = [42];

    Object.defineProperty(rows, '0', {
        enumerable: true,
        configurable: true,
        get() {
            reads += 1;
            if (kind === 'raising') throw new Error('unread array element');
            return 42;
        }
    });

    return rows;
}
