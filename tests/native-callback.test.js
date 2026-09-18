// A callback JavaScript built, handed through a Python component.
//
// What a component returns to the framework goes through `pyNumbers`, which
// unwraps Brython floats and adapts Python callbacks: a framework calls them
// with raw numbers, and Brython reads a number as an int. Every callable was
// sent through that adaptation, and a function JavaScript built came back
// wrapped in one that converted its arguments — so a library's own
// `t => t.toFixed(2)`, passed along by a thin Python wrapper, was handed a
// Brython float. `Number.isFinite` answered false and `toFixed` raised, on a
// function the author never asked anyone to touch.
//
// Arithmetic does not tell the two apart, which is why the assertions are
// `Number.isFinite` and `toFixed`: `t * t` answers the same for a float object
// as for a number, and the first reading of this defect nearly rested on it.
//
// The witness is the same shape with Python callbacks, which must still be
// adapted — the two halves of one rule, in one file.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import NativeConfig from './fixtures/NativeConfig.svelte';
import { config } from './fixtures/native_config.js';
import { rounded, shortened, wrapped, from_python } from './fixtures/native_function.py';

const mounted = () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(NativeConfig, { target });

    flushSync();

    return instance;
};

describe('a configuration a JavaScript library built', () => {
    test('keeps the arguments its callbacks expect', () => {
        const held = mounted().native();

        expect(held.finite(0.5)).toBe(true);
        expect(held.format(0.5)).toBe('0.50');
    });

    // The same answers as the configuration that never crossed, which is what
    // *unchanged* means here.
    test('and answers exactly as it does without crossing', () => {
        const held = mounted().native();
        const straight = config();

        expect(held.finite(0.5)).toBe(straight.finite(0.5));
        expect(held.format(0.5)).toBe(straight.format(0.5));
        expect(held.easing(0.5)).toBe(straight.easing(0.5));
    });

    // The numbers beside the callbacks are still converted: what crosses is a
    // Python dict, and its values are Python values.
    test('while the data beside them still crosses as data', () => {
        expect(mounted().native().duration).toBe(400);
    });
});

// And the half that must not change: a Python callback in the same position is
// called by the framework with raw numbers, so it is adapted, and what it hands
// back is a number JavaScript can compute with.
describe('a configuration whose callback is Python', () => {
    test('is adapted, and answers a number', () => {
        const eased = mounted().python_config().easing(0.5);

        expect(typeof eased).toBe('number');
        expect(eased).toBe(0.25);
    });

    // And it is **one** function, however many times the configuration is read.
    //
    // The adapter underneath was cached; the layer that converts the arguments
    // was built fresh at every conversion, and that layer is what the consumer
    // is handed. So a component read twice gave two JavaScript functions for one
    // Python callback, and a registry could not take back what it had been
    // given: the cache inside settles nothing if the function published is a new
    // object wrapped around it.
    test('and reading it twice gives the same function', () => {
        const instance = mounted();
        const first = instance.kept_config().easing;
        const second = instance.kept_config().easing;

        expect(first).toBe(second);

        const registry = new Set([first]);

        expect(registry.delete(second)).toBe(true);
        expect(registry.size).toBe(0);
    });

    test('while still answering what it answered', () => {
        expect(mounted().kept_config().easing(0.5)).toBe(0.25);
        expect(mounted().kept_config().duration).toBe(400);
    });
});

// And the third answer to the same question, which the boundary did not have.
//
// *Is this function Python's or JavaScript's?* was decided by reading the
// signature Brython records, and a **builtin** has none: `round` carries
// `["builtins", "round", "round"]` and no arity, because it is written in
// JavaScript inside the engine rather than compiled from Python. No signature
// was read as *not Python's*, so `rounded = round` published by a module was
// handed over untouched — and a JavaScript caller passing `0.25` was answered
// *type Javascript Number doesn't define __round__ method*.
//
// The two decisions are separate: not knowing what a function takes says nothing
// about what it *expects*, and a builtin expects Python on both sides. It takes
// everything it is given now, since there is no number to trim to, and the
// conversion does the rest.
//
// An integer is why it stayed hidden: `rounded(2, 1)` answered 2 throughout,
// because 2 is the same value to both languages.
describe('a builtin a module publishes', () => {
    test('takes a fractional argument', () => {
        expect(rounded(0.25, 1)).toBe(0.2);
    });

    test('and hands back a number JavaScript can compute with', () => {
        const got = rounded(0.25, 1);

        expect(typeof got).toBe('number');
        expect(1 + got).toBe(1.2);
    });

    test('while an integer worked all along, which is what hid it', () => {
        expect(rounded(2, 1)).toBe(2);
    });

    // A second one, so the repair is not a special case of `round`.
    test('and it is not one builtin', () => {
        expect(shortened(-0.25)).toBe(0.25);
    });

    // The controls: the same call written as a `def`, and the same call made in
    // Python, both of which always answered.
    test.for([
        ['wrapped in a def', () => wrapped(0.25)],
        ['made in Python', () => from_python()]
    ])('as it already did %s', ([, reach]) => {
        expect(reach()).toBe(0.2);
    });
});
