// @vitest-environment node
//
// What `Object.defineProperty` does to the view of a Python container, against
// what it does to Svelte's own state, the proxy a `$state` object or array is.
// The view wrote the value first and let the engine refuse the descriptor
// afterwards: the call threw and the data had changed all the same, or a
// read-only property was accepted and stayed writable.
import { test, expect, describe } from 'vitest';
import { proxy } from 'svelte/internal/client';
import { __pybridge, pyData } from '../src/lib/runtime.js';

const pair = (data) => ({
    svelte: proxy(structuredClone(data)),
    python: __pybridge.bound(pyData(data))
});

const SHAPES = [
    ['a dict', { x: 1 }, 'x'],
    ['a list', [1, 2], '0']
];

describe.for(SHAPES)('on %s', ([, data, key]) => {
    test.for([
        ['not configurable', { value: 7, writable: true, enumerable: true, configurable: false }],
        ['read-only', { value: 7, writable: false, enumerable: true, configurable: true }],
        ['not enumerable', { value: 7, writable: true, enumerable: false, configurable: true }],
        ['an accessor', { get: () => 7, enumerable: true, configurable: true }]
    ])('a descriptor %s is refused before anything is written', ([, descriptor]) => {
        const { svelte, python } = pair(data);

        expect(() => Object.defineProperty(svelte, key, descriptor)).toThrow();
        expect(() => Object.defineProperty(python, key, descriptor)).toThrow(TypeError);

        expect(python[key]).toBe(svelte[key]);
        expect(python[key]).toBe(1);
        expect(Object.getOwnPropertyDescriptor(python, key).writable).toBe(true);
    });

    // Svelte's state stays readable once it refuses new keys, the keys being
    // real on its target. A view's are its container's, which Python may still
    // add to: it refuses instead, before its shell is locked, and stays readable
    // and growable. `freeze` and `seal` begin with the same request.
    test.for([['preventExtensions'], ['freeze'], ['seal']])('`Object.%s` is refused and the view stays readable', ([name]) => {
        const { svelte, python } = pair(data);

        expect(() => Object[name](python)).toThrow(TypeError);
        expect(Reflect.preventExtensions(python)).toBe(false);

        expect(Object.keys(python)).toEqual(Object.keys(svelte));
        expect(() => Object.getPrototypeOf(python)).not.toThrow();
        expect(Array.isArray(python)).toBe(Array.isArray(svelte));
        expect(Object.isExtensible(python)).toBe(true);
        expect(python[key]).toBe(1);
    });

    // The prototype is the view's shape, a list's methods among it: the list
    // took a new one and went on announcing the old, `push` gone. Refused, as
    // Svelte's state refuses it.
    test.for([
        ['null', null],
        ["an object's", Object.prototype],
        ["an array's", Array.prototype]
    ])('a prototype, %s, is refused, as by Svelte', ([, proto]) => {
        const { svelte, python } = pair(data);
        const before = Object.getPrototypeOf(python);

        expect(() => Object.setPrototypeOf(svelte, proto)).toThrow();
        expect(() => Object.setPrototypeOf(python, proto)).toThrow(TypeError);

        expect(Object.getPrototypeOf(python)).toBe(before);
        expect(typeof python.push).toBe(typeof svelte.push);
        expect(Object.keys(python)).toEqual(Object.keys(svelte));
    });

    test.for([
        ['in full', { value: 7, writable: true, enumerable: true, configurable: true }],
        ['with only a value', { value: 7 }]
    ])('while a value %s is written, as on Svelte state', ([, descriptor]) => {
        const { svelte, python } = pair(data);

        Object.defineProperty(svelte, key, descriptor);
        Object.defineProperty(python, key, descriptor);

        expect(python[key]).toBe(svelte[key]);
        expect(python[key]).toBe(7);
    });
});
