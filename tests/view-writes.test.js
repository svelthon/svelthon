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

    // A `delete` keeps the length, at the last index as at any other, as on an
    // array; `pop` is what shortens it.
    test.for([[0], [1], [2]])('delete at %s keeps the length, as on an array', ([at]) => {
        const native = [1, 2, 3];
        const { view: list } = view([1, 2, 3]);

        delete native[at];
        delete list[at];

        expect(list.length).toBe(native.length);
        list.pop();
        native.pop();
        expect(list.length).toBe(native.length);
    });

    // A number from 2³² − 1 up is no index to an array, only a property, and
    // the view took it for one: `values['4294967295'] = 7` appended None after
    // None, billions of times, on the page's only thread. A list holds no other
    // property, so the write is refused, through `defineProperty` too, and
    // the length is the array's.
    //
    // The appends are counted and stopped at the tenth, so that a regression
    // fails here rather than filling the worker's memory.
    test.for([
        ['2³² − 1', '4294967295'],
        ['2³²', '4294967296'],
        ['2⁵³ + 1', '9007199254740993'],
        ['of 310 digits', '9'.repeat(310)]
    ])(
        'the property %s is no index, and the list keeps its length as an array does',
        ([, key]) => {
            const native = [1, 2, 3];
            const { source, view: list } = view([1, 2, 3]);
            const $B = globalThis.__BRYTHON__;
            const getattr = $B.$getattr;
            let appends = 0;

            $B.$getattr = function (object, name, ...rest) {
                const found = getattr.call(this, object, name, ...rest);
                if (object !== source || name !== 'append') return found;

                return (...given) => {
                    if (++appends > 10) throw new Error('the list grew past ten appends');
                    return $B.$call(found, ...given);
                };
            };

            try {
                Reflect.set(native, key, 7);

                expect(Reflect.set(list, key, 7)).toBe(false);
                expect(() => Object.defineProperty(list, key, { value: 7 })).toThrow(TypeError);
            } finally {
                $B.$getattr = getattr;
            }

            expect(appends).toBe(0);
            expect(list.length).toBe(native.length);
            expect([...source]).toEqual([1, 2, 3]);
        }
    );

    // While an index past the end still grows the list, as it grows an array.
    test('an index past the end grows the list, None in the gap', () => {
        const native = [1, 2, 3];
        const { view: list } = view([1, 2, 3]);

        native[4] = 7;

        expect(Reflect.set(list, '4', 7)).toBe(true);
        expect([...list].map((one) => one ?? undefined)).toEqual([...native]);
    });

    // Growing fills with None where an array has holes: both read as nothing.
    test.for([[1], [5], ['2'], [0]])('while %s is a length, as for an array', ([length]) => {
        const native = [1, 2, 3];
        const { view: list } = view([1, 2, 3]);

        native.length = length;
        list.length = length;

        expect([...list].map((one) => one ?? undefined)).toEqual([...native]);
    });
});
