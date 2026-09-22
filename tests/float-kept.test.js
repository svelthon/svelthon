// **A float that goes back into Python comes back a float.**
//
// What a template function hands to Svelte is made a JavaScript number, because
// a Brython float is an object `{ob_type, value}` and the DOM wants a number.
// Brython reads a JavaScript number that is not whole as a `JSObject`, so a
// value the markup keeps and Python reads again — a declaration, a default of a
// pattern, an argument of `{@render}` — came back a `JSObject`, and arithmetic
// on it was no longer Python's. Those keep their Python value; a value bound
// for the DOM is still made a number.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import FloatKept from './fixtures/FloatKept.svelte';

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(FloatKept, { target });
    flushSync();

    return (k) => target.querySelector(`[data-k="${k}"]`);
};

test.for([
    ['a default of a pattern', 'default'],
    ['a declaration of the markup', 'declared'],
    ['and one of a module name', 'declared-name'],
    ['an argument of {@render}', 'render']
])('%s keeps a float a float', ([, key]) => {
    expect(setup()(key).textContent).toBe('float:1.0');
});

test('while an attribute still receives a JavaScript number', () => {
    expect(setup()('attribute').value).toBe(0.5);
});
