import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';

import Retained from './fixtures/Retained.svelte';
import { pyNumbers } from '../src/lib/runtime.js';

// `pyNumbers` unwraps Brython floats one level down, so that what a Python `def`
// hands to the *framework* is a number: `Element.animate` refuses a duration
// that is an object holding one.
//
// It used to do that by writing back into the object it was given, which is the
// caller's. A component that hands out state it also keeps had that state
// downgraded in place, and Python then read a `JSObject` where it had put a
// float. `str(x)` still printed `0.25`, which is what made it quiet: the page
// went on rendering correctly and the arithmetic stopped working.
describe('a value handed to JavaScript leaves Python’s copy alone', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(Retained, { target });
        flushSync();

        return instance;
    };

    // The reported path, end to end: a parent holding the instance reads a
    // container the component keeps, then asks Python about it.
    test('an @export that hands out retained state does not spend it', () => {
        const child = setup();

        expect(child.kind()).toBe('float');
        child.give_dict();
        expect(child.kind()).toBe('float');
    });

    test('and the arithmetic still works afterwards', () => {
        const child = setup();

        child.give_dict();
        expect(child.rounded()).toBe(0.2);
    });

    test('a list is not spent either, and stays a list on both sides', () => {
        const child = setup();
        const out = child.give_list();

        expect(child.shown()).toBe('[0.5, 1]');
        expect(Array.isArray(out)).toBe(true);
        expect(out[0]).toBe(0.5);
    });

    // What the unwrapping is *for*: the caller sees numbers, not objects.
    test('what JavaScript receives is unwrapped, which is the whole point', () => {
        const child = setup();

        expect(child.give_dict().rate).toBe(0.25);
    });
});

describe('the copy is built only when there is something to change', () => {
    test('a value with nothing to unwrap is handed back as it was', () => {
        const plain = { duration: 300, delay: 0 };

        expect(pyNumbers(plain)).toBe(plain);
    });

    test('a scalar and a bare float cross without a container at all', () => {
        expect(pyNumbers(3)).toBe(3);
        expect(pyNumbers(null)).toBe(null);
        expect(pyNumbers('x')).toBe('x');
    });

    test('but one that does need a change comes back as a different object', () => {
        const held = { easing: (t) => t };

        expect(pyNumbers(held)).not.toBe(held);
        expect(typeof held.easing).toBe('function');
    });
});
