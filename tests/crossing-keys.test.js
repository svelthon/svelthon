// @vitest-environment node
//
// What a dict's *keys* do to the conversion that hands it to JavaScript. Both
// cases below are ordinary Python: a mapping parsed from JSON, a field called
// `constructor`. Neither is exotic, and the boundary decided things from them
// that belong to JavaScript's object model rather than to the data.
import { test, expect, describe } from 'vitest';
import { plainData } from '../src/lib/runtime.js';

describe('a key is data, whatever JavaScript calls it', () => {
    // `out[key] = value` runs the setter `__proto__` has on `Object.prototype`.
    // The key vanished from the result and became its prototype, so the object
    // lost a field and answered for one it never had.
    const hostile = () => JSON.parse('{"__proto__":{"flag":42},"ok":1}');

    test('__proto__ stays a key', () => {
        expect(Object.keys(plainData(hostile()))).toContain('__proto__');
    });

    test('and does not become the prototype', () => {
        const out = plainData(hostile());

        expect(out.flag).toBeUndefined();
        expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    });

    test('the value it held crosses like any other', () => {
        expect(plainData(hostile())['__proto__'].flag).toBe(42);
    });
});

// A Response, a URL, a Date are not ours to flatten, and the test for them read
// `value.constructor`. A mapping may hold that word: `{"constructor": "invoice"}`
// answered a class of its own, so the whole dict crossed unconverted and the
// Python float inside it reached JavaScript as a Brython object.
describe('a field called constructor is a field', () => {
    const dict = (extra) => {
        const $B = globalThis.__BRYTHON__;
        return { amount: $B.builtins.float.$factory(1.5), ...extra };
    };

    test('the float crosses without it', () => {
        expect(plainData(dict())).toEqual({ amount: 1.5 });
    });

    test('and with it', () => {
        expect(plainData(dict({ constructor: 'invoice' })).amount).toBe(1.5);
    });

    test('and the field is kept', () => {
        expect(plainData(dict({ constructor: 'invoice' })).constructor).toBe('invoice');
    });

    // The reason the test existed, still standing: what a framework built stays
    // what it was.
    test('a real class is still handed over untouched', () => {
        const url = new URL('https://peps.python.org/pep-0703/');

        expect(plainData(url)).toBe(url);
    });
});
