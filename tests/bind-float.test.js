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

    // And arrives as a float. A range and a text field hand over a string, which
    // Python reads as a string; a `type="number"` field is the one Svelte
    // converts, and it hands over a JavaScript number. Brython reads a
    // non-integer one as a `JSObject`, which prints `0.42` and is not a number:
    // the page looks right and `round(ratio, 1)` raises.
    test('and arrives as a float, not as a JSObject', () => {
        const at = setup();
        const input = at('number');
        input.value = '0.42';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
        expect(at('back').textContent).toBe('0.42');
        expect(at('back-type').textContent).toBe('float');
    });

    // A cleared number field hands over `null`, and Python reads the `null` it
    // is, `javascript.NULL`: the engine's pairing, which `pyArg` and `pyData`
    // keep, at the binding. A name and an item, the two targets a binding
    // writes through.
    test('a cleared number field arrives as null', () => {
        const at = setup();
        for (const k of ['int', 'item']) {
            at(k).value = '';
            at(k).dispatchEvent(new Event('input', { bubbles: true }));
        }
        flushSync();
        expect(at('absent').textContent).toBe('True True');
    });

    test('control: zero is a value, not an absence', () => {
        const at = setup();
        for (const k of ['int', 'item']) {
            at(k).value = '0';
            at(k).dispatchEvent(new Event('input', { bubbles: true }));
        }
        flushSync();
        expect(at('absent').textContent).toBe('False False');
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

    // A Python dict holds it: a JavaScript object never does, since Brython
    // converts whatever Python writes into one.
    const dict = (key, value) => {
        const out = $B.builtins.dict.$factory();

        $B.$setitem(out, key, value);

        return out;
    };

    test('plainData unwraps one inside a container', () =>
        expect(plainData(dict('ratio', float(0.5))).ratio).toBe(0.5));

    test('pyNumbers unwraps the values of a returned mapping', () =>
        expect(pyNumbers(dict('duration', float(4300))).duration).toBe(4300));

    test('pyNumbers leaves everything else alone', () => {
        const kept = { name: 'x', n: 43 };
        expect(pyNumbers(kept)).toEqual({ name: 'x', n: 43 });
    });

    // `09-transitions/04-custom-js-transitions` — the framework keeps a callback
    // and calls it with its own numbers, Brython reads a number as an int, and
    // every frame after the first raises *0.093 cannot be converted to a
    // BigInt*, silently — used to be checked here with a JavaScript arrow
    // standing in for the author's `tick`.
    //
    // The stand-in stopped standing for it: a callback JavaScript built keeps
    // its own arguments now, because wrapping one changed the contract of a
    // library's own function. The contract is held where each half is real:
    // `tests/bound-config.test.js` mounts a component whose `tick` is Python and
    // watches the float arrive, and `tests/py-numbers.test.js` holds the
    // JavaScript half beside it.
});
