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

    // What the memory must not undo: a container that is already Python's is
    // handed back, not rebuilt.
    test('while a Python list is still the same list', () => {
        const $B = globalThis.__BRYTHON__;
        const xs = $B.builtins.list.$factory([1, 2]);

        expect(pyData(xs)).toBe(xs);
        expect($B.class_name(pyData($B.fast_tuple([1, 2])))).toBe('tuple');
    });
});
