// @vitest-environment node
//
// What JavaScript writes through the view of a Python list, against what the
// same write does to an array.
import { test, expect, describe } from 'vitest';
import '../src/lib/compile.js';
import { __brycomp_pybridge, pyData } from '../src/lib/bridge.js';

const view = (items) => {
    const source = pyData(items);

    return { source, view: __brycomp_pybridge.bound(source) };
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

    // A `bigint` is no length to an array, and a value is converted twice, so an
    // object answering 1 then 2 is refused there. The view converted once with
    // `Number`, which takes a `bigint`: `1n` cut the Python list to one element.
    test.for([
        ['1n', () => 1n],
        ['0n', () => 0n],
        ['an object answering 1 then 2', () => {
            let calls = 0;
            return { valueOf: () => ++calls };
        }],
        ['an object raising at its second conversion', () => {
            let calls = 0;
            return {
                valueOf: () => {
                    if (++calls > 1) throw new Error('second conversion');
                    return 1;
                }
            };
        }]
    ])('%s is refused as an array refuses it, the list kept', ([, made]) => {
        const native = [1, 2, 3];
        const { source, view: list } = view([1, 2, 3]);
        let refusal;

        try {
            native.length = made();
        } catch (error) {
            refusal = error.constructor;
        }

        expect(refusal).toBeDefined();
        expect(() => {
            list.length = made();
        }).toThrow(refusal);
        expect([...source]).toEqual(native);
    });

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
    // The calls that grow the list are counted and stopped at the tenth, so
    // that a regression fails here rather than filling the worker's memory.
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
                if (object !== source || (name !== 'append' && name !== 'extend')) return found;

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

// A subclass whose `pop` or `append` moves nothing: the length and an index
// past the end are written as Python writes them, `del rows[n:]` and
// `rows.extend(...)`, and the write ends where an array's does. Each method
// raises past its tenth call, so a loop on it fails here.
describe('a subclass whose pop or append moves nothing', () => {
    const $B = globalThis.__BRYTHON__;
    const source = [
        'calls = [0]',
        '',
        '',
        'def counted():',
        '    calls[0] += 1',
        '    if calls[0] > 10:',
        '        raise RuntimeError("called past ten times")',
        '',
        '',
        'class StuckPop(list):',
        '    def pop(self, index=-1):',
        '        counted()',
        '        return 99',
        '',
        '',
        'class StuckAppend(list):',
        '    def append(self, value):',
        '        counted()',
        ''
    ].join('\n');
    const js = $B.py2js({ src: source, filename: 'stuck_rows.py' }, 'stuck_rows', ['stuck_rows']).to_js();
    const module = new Function(`${js}\nreturn locals_stuck_rows_py;`)();

    test.for([
        ['pop', 'the length 0', [1, 2], (rows) => (rows.length = 0)],
        ['append', 'the length 3', [1], (rows) => (rows.length = 3)],
        ['append', 'the index 3', [1], (rows) => (rows[3] = 9)]
    ])('with %s stuck, %s is written as on an array', ([stuck, , items, write]) => {
        const native = [...items];
        const list = __brycomp_pybridge.bound($B.$call(module[stuck === 'pop' ? 'StuckPop' : 'StuckAppend'], pyData(items)));

        write(native);
        write(list);

        expect([...list].map((one) => one ?? undefined)).toEqual([...native]);
    });
});
