// @vitest-environment node
//
// The way out, which used to undo the way in.
//
// `pyData` was taught that a graph is not a tree, so a shared reference crosses
// into Python as one dict. `plainData` flattened it again on the way back: the
// round trip was not one, and `to_js` *is* `plainData` — the emitted code puts
// it on the return value of every Python function crossing to JavaScript.
//
// The flattening rule was not an oversight. It is right for the consumer that
// prompted it: `tojson` produces JSON, which has neither identity nor cycles.
// It was written for one of six callers and applied to all of them.
import { test, expect, describe } from 'vitest';
import { plainData } from '../src/lib/runtime.js';

const $B = globalThis.__BRYTHON__;
const _b_ = $B.builtins;

const dict = (entries) => {
    const out = _b_.dict.$factory();

    for (const [key, value] of entries) $B.$setitem(out, key, value);

    return out;
};

describe('a Python structure handed to JavaScript', () => {
    test('keeps a shared list as one array', () => {
        const shared = _b_.list.$factory([1]);
        const out = plainData(_b_.list.$factory([shared, shared]));

        expect(out[0]).toBe(out[1]);

        out[0].push(2);

        expect(out[1]).toHaveLength(2);
    });

    test('and a shared dict as one object', () => {
        const shared = dict([['n', 1]]);
        const out = plainData(dict([['a', shared], ['b', shared]]));

        expect(out.a).toBe(out.b);

        out.a.n = 99;

        expect(out.b.n).toBe(99);
    });

    test('a loop comes out as the loop', () => {
        const xs = _b_.list.$factory([]);

        xs.push(xs);

        const out = plainData(xs);

        expect(out[0]).toBe(out);
    });

    // A value that crosses *unconverted* has to cross once too.
    //
    // The shell is registered before `branch` decides, which is what answers a
    // cycle — but `branch` hands a Date, a Map, a Promise or a Response straight
    // back rather than filling it. The memo kept the guess instead of the
    // answer, so the first reference was a real date and the second was `{}`.
    test('a date under two keys is the same date twice', () => {
        const when = new Date('2026-01-01T00:00:00Z');
        const out = plainData(dict([['a', when], ['b', when]]));

        expect(out.a).toBe(when);
        expect(out.b).toBe(when);
    });

    test('and a map repeated in a list keeps its interface', () => {
        const held = new Map([['k', 1]]);
        const out = plainData(_b_.list.$factory([held, held]));

        expect(out[0]).toBe(held);
        expect(out[1]).toBe(held);
        expect(out[1].get('k')).toBe(1);
    });

    // The JSON rule, still there, asked for by name. A `Set` says so.
    test('while JSON flattens the sharing and blanks the loop', () => {
        const shared = _b_.list.$factory([1]);
        const out = plainData(_b_.list.$factory([shared, shared]), new Set());

        expect(out[0]).not.toBe(out[1]);
        expect(out).toEqual([[1], [1]]);
    });
});
