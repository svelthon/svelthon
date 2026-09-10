import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BindFloat from './fixtures/BindFloat.svelte';
import { plainData, pyNumbers } from '../src/lib/runtime.js';

// A binding is the one place a Python value reaches the DOM unconverted, and a
// Brython float is an object rather than a number. Every input below used to
// read it wrong, each in its own way.
describe('a float across a binding', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(BindFloat, { target });
        flushSync();
        return (k) => target.querySelector(`[data-k="${k}"]`);
    };

    test('a range reads it instead of falling back to the middle of its scale', () =>
        expect(setup()('range').value).toBe('0.1'));

    test('a number field reads it instead of staying empty', () =>
        expect(setup()('number').value).toBe('0.1'));

    test('a text field reads it instead of showing [object Object]', () =>
        expect(setup()('text').value).toBe('0.1'));

    test('an int was never affected', () => expect(setup()('int').value).toBe('1'));

    // What `08-motion/01-spring` writes: the target is a member of a JavaScript
    // object rather than a module-level name.
    test('and a member of a JavaScript object reads the same way', () =>
        expect(setup()('member').value).toBe('0.25'));

    // The other direction was never broken, and has to stay that way.
    test('writing still reaches Python', () => {
        const at = setup();
        const input = at('range');
        input.value = '0.42';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
        expect(at('back').textContent).toBe('0.42');
    });
});

// The other two halves of the same boundary. A transition cannot be mounted
// here — jsdom has no `element.animate` — so what a transition hands back is
// checked on the converters themselves, with a float built the way Brython
// builds one.
describe('a float handed back to the framework', () => {
    const $B = globalThis.__BRYTHON__;
    const float = (n) => $B.fast_float(n);

    test('a Brython float is an object, which is the whole problem', () => {
        expect(typeof float(4300)).toBe('object');
        expect(typeof 43).toBe('number');
    });

    // `tojson(1 / 3)` without this renders 20 KB: the float's type, its
    // descriptors, and theirs.
    test('plainData unwraps it', () => expect(plainData(float(4300))).toBe(4300));

    test('plainData unwraps one inside a container', () =>
        expect(plainData({ ratio: float(0.5) }).ratio).toBe(0.5));

    test('pyNumbers unwraps the values of a returned mapping', () =>
        expect(pyNumbers({ duration: float(4300) }).duration).toBe(4300));

    test('pyNumbers leaves everything else alone', () => {
        const kept = { name: 'x', n: 43 };
        expect(pyNumbers(kept)).toEqual({ name: 'x', n: 43 });
    });

    // `09-transitions/04-custom-js-transitions`: the framework keeps a callback
    // and calls it with its own numbers. Brython reads a JavaScript number as an
    // int, so `tick(0, 1)` works and every frame after it raises *the number
    // 0.093 cannot be converted to a BigInt*, silently.
    test('and wraps a callback so a JavaScript float reaches it as one', () => {
        let seen;
        const out = pyNumbers({ tick: (t) => { seen = t; return t; } });
        out.tick(0.093);
        expect(typeof seen).toBe('object');
        expect(seen.value).toBeCloseTo(0.093);
    });
});
