import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';

import Retained from './fixtures/Retained.svelte';
import { pyNumbers } from '../src/lib/bridge.js';

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
    const float = (n) => globalThis.__BRYTHON__.fast_float(n);

    test('a value with nothing to unwrap is handed back as it was', () => {
        const plain = { duration: 300, delay: 0 };

        expect(pyNumbers(plain)).toBe(plain);
    });

    test('a scalar and a bare float cross without a container at all', () => {
        expect(pyNumbers(3)).toBe(3);
        expect(pyNumbers(null)).toBe(null);
        expect(pyNumbers('x')).toBe('x');
    });

    // A Python dict: a JavaScript object never holds a Brython float, since
    // Brython converts whatever Python writes into one.
    test('but one that does need a change comes back as a different object', () => {
        const $B = globalThis.__BRYTHON__;
        const held = $B.builtins.dict.$factory();

        $B.$setitem(held, 'duration', float(300));

        expect(pyNumbers(held)).not.toBe(held);
        expect(pyNumbers(held).duration).toBe(300);
    });

    // And the dimension this file did not have: **where the callback comes
    // from**. A Python one is adapted, because a framework calls it with raw
    // numbers and Brython reads a number as an int. A function JavaScript built
    // is left exactly as it is, arguments included — it was wrapped all the same,
    // so a library's own `t => t.toFixed(2)`, handed through a Python component,
    // received a Brython float: `Number.isFinite` answered false and `toFixed`
    // raised, on a function the author never asked anyone to touch.
    //
    // The Python half of the same rule is `tests/bound-config.test.js`, which
    // holds it end to end, on a component, where the callback really is Python.
    test('a callback JavaScript built keeps its own arguments', () => {
        let seen;
        const held = { format: (t) => (seen = t) };
        const out = pyNumbers(held);

        expect(out).toBe(held);
        expect(out.format).toBe(held.format);

        out.format(0.5);

        expect(typeof seen).toBe('number');
        expect(seen).toBe(0.5);
    });
});
