// @vitest-environment node
//
// `to_py` accepts whatever JavaScript hands it, and a JavaScript array belongs
// to a graph rather than to a tree. The walk had no memory: an array containing
// itself answered `RangeError: Maximum call stack size exceeded`, and two
// references to one array became two lists.
//
// So each array is registered before its children are walked. That also settles
// the shared reference, which is the same fact seen without a cycle.
import { test, expect, describe } from 'vitest';
import { pyData } from '../src/lib/runtime.js';

describe('to_py on a graph', () => {
    test('an array that contains itself', () => {
        const xs = [];

        xs.push(xs);

        const converted = pyData(xs);

        expect(converted.length).toBe(1);
        expect(converted[0]).toBe(converted);
    });

    test('a cycle between two arrays', () => {
        const a = [];
        const b = [a];

        a.push(b);

        const converted = pyData(a);

        expect(converted[0][0]).toBe(converted);
    });

    test('and a shared reference stays one list', () => {
        const shared = [1];
        const converted = pyData([shared, shared]);

        expect(converted[0]).toBe(converted[1]);
        expect([...converted[0]]).toEqual([1]);
    });

    // A JavaScript graph is not made of arrays only, and the object half could
    // not be a copy of the array one: the overflow was inside Brython's own
    // `convert_to_python`, which is tree-only. Taking arrays out of its hands
    // and leaving objects in them is what made the two halves disagree.
    test('an object that contains itself', () => {
        const o = {};

        o.self = o;

        const converted = pyData(o);
        const $B = globalThis.__BRYTHON__;

        expect($B.$getitem(converted, 'self')).toBe(converted);
    });

    test('a cycle that goes through an array', () => {
        const $B = globalThis.__BRYTHON__;
        const o = {};

        o.xs = [o];

        const converted = pyData(o);

        expect($B.$getitem(converted, 'xs')[0]).toBe(converted);
    });

    // The silent face, and the one that matters: this framework updates by
    // mutation, so two names that stop being one thing is a write that stops
    // arriving.
    test('and two references to one object stay one dict', () => {
        const $B = globalThis.__BRYTHON__;
        const shared = { n: 1 };
        const converted = pyData({ a: shared, b: shared });

        expect($B.$getitem(converted, 'a')).toBe($B.$getitem(converted, 'b'));

        $B.$setitem($B.$getitem(converted, 'a'), 'n', 99);

        expect($B.$getitem($B.$getitem(converted, 'b'), 'n')).toBe(99);
    });

    // What the memory must not undo: a container that is already Python's is
    // handed back, not rebuilt.
    test('while a Python list is still the same list', () => {
        const $B = globalThis.__BRYTHON__;
        const xs = $B.builtins.list.$factory([1, 2]);

        expect(pyData(xs)).toBe(xs);
        expect($B.class_name(pyData($B.fast_tuple([1, 2])))).toBe('tuple');
    });
});
