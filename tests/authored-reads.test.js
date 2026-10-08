// @vitest-environment node
//
// A view whose reads are the author's code, a `__getitem__` or a
// `__getattribute__` of their class, against a JavaScript object whose property
// is a getter: listing the keys reads nothing, a copy reads each value once,
// and what a read raises comes from a read only. The view described each
// property by reading it, so `Object.keys` read every value and raised what the
// read raised, and a spread read each one twice and kept the second answer.
import { test, expect, describe } from 'vitest';
import * as python from './fixtures/authored_reads.py';

const KEY = { dict: 'value', instance: 'value', list: '0', tuple: '0' };

const OPERATIONS = [
    ['Object.keys', (x) => Object.keys(x)],
    ['Object.entries', (x) => Object.entries(x)],
    ['Object.values', (x) => Object.values(x)],
    ['a spread', (x) => ({ ...x })],
    ['Object.assign', (x) => Object.assign({}, x)]
];

// The same key on a JavaScript object, or an array, as an own enumerable getter
// that counts its reads as the Python one does.
const witness = (kind, how) => {
    let reads = 0;
    const made = kind === 'list' || kind === 'tuple' ? [] : {};

    Object.defineProperty(made, KEY[kind], {
        get() {
            reads += 1;
            if (how === 'raising') throw new Error('value was read');

            return how === 'counting' ? reads : 42;
        },
        set() {},
        enumerable: true,
        configurable: true
    });

    return { made, reads: () => reads };
};

const run = (made, operation) => {
    try {
        return { output: operation(made), raised: false };
    } catch (error) {
        return { output: null, raised: /value was read/.test(String(error.message ?? error)) };
    }
};

describe.for([
    ['a dict', 'dict'],
    ['a list', 'list'],
    ['a tuple', 'tuple'],
    ['an instance', 'instance']
])("%s whose reads are the author's", ([, kind]) => {
    test.for(OPERATIONS)('%s reads it as a getter is read', ([, operation]) => {
        for (const how of ['same', 'counting', 'raising']) {
            const js = witness(kind, how);
            const theirs = { ...run(js.made, operation), reads: js.reads() };

            python.make(kind, how);

            expect({ ...run(python.made, operation), reads: python.reads() }).toEqual(theirs);
        }
    });

    test('its property is a getter and a setter, both through the view', () => {
        python.make(kind);
        const view = python.made;
        const found = Object.getOwnPropertyDescriptor(view, KEY[kind]);

        expect(Object.keys(found).sort()).toEqual(['configurable', 'enumerable', 'get', 'set']);
        expect(python.reads()).toBe(0);
        expect(found.get()).toBe(42);
        expect(python.reads()).toBe(1);

        if (kind === 'tuple') {
            expect(() => found.set(7)).toThrow(TypeError);
        } else {
            found.set(7);
            expect(view[KEY[kind]]).toBe(7);
        }

        python.make(kind, 'raising');
        expect(() => Object.getOwnPropertyDescriptor(python.made, KEY[kind]).get()).toThrow(/value was read/);
    });
});

// An instance whose reads are Python's own holds its values, as the views of a
// dict and a list do (`view-descriptors.test.js`).
test('an instance read by Python alone holds its values', () => {
    python.make('plain');

    expect(Object.getOwnPropertyDescriptor(python.made, 'value')).toEqual({
        value: 42,
        writable: true,
        enumerable: true,
        configurable: true
    });
});
