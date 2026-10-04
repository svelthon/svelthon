// @vitest-environment node
//
// What JavaScript writes through the view of a Python list, against what the
// same write does to an array.
import { test, expect, describe } from 'vitest';
import { __pybridge, pyData } from '../src/lib/runtime.js';

const view = (items) => {
    const source = pyData(items);

    return { source, view: __pybridge.bound(source) };
};

// The view's setter of `length` popped and appended without asking first:
// `-1` emptied the list before failing on `pop index out of range`, `1.5` gave
// `[1, None]`, `NaN` was accepted. An array refuses all three with a RangeError
// and keeps its elements.
describe('a length an array would refuse', () => {
    test.for([[-1], [1.5], [NaN], [2 ** 32], [Infinity], ['two']])(
        '%s is refused and the list is kept, as an array is',
        ([length]) => {
            const native = [1, 2, 3];
            const { source, view: list } = view([1, 2, 3]);

            expect(() => {
                native.length = length;
            }).toThrow(RangeError);
            expect(() => {
                list.length = length;
            }).toThrow(RangeError);

            expect([...source]).toEqual(native);
        }
    );

    // Growing fills with None where an array has holes: both read as nothing.
    test.for([[1], [5], ['2'], [0]])('while %s is a length, as for an array', ([length]) => {
        const native = [1, 2, 3];
        const { view: list } = view([1, 2, 3]);

        native.length = length;
        list.length = length;

        expect([...list].map((one) => one ?? undefined)).toEqual([...native]);
    });
});
