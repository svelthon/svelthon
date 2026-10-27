// What `positional-reads-once.test.js` and its server half hand the snippets
// and expect of them: iterators that raise past the positions a pattern names,
// and rows whose element counts its reads.

// An iterator that hands what it is given, and raises past it.
function* only(...values) {
    yield* values;
    throw new Error('read past the positions the pattern names');
}

// A row whose element at `at` counts its reads, `21` the first time.
const counting = (row, at) => {
    let reads = 0;

    Object.defineProperty(row, at, { get: () => ++reads * 21, enumerable: true });
    return row;
};

export const props = () => ({
    trailing: only(21),
    holes: only(21, 0),
    leading: only(0, 21),
    counted: counting([], 0),
    missing: Object.defineProperty([], 0, { get: () => undefined })
});

export const EXPECTED = { trailing: '21', holes: '21', leading: '21', counted: '21', missing: '7' };
