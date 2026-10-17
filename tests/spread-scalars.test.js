// **A Python scalar spread onto an element is the attribute it is written by
// name.** Each value of the spread crossed as the engine holds it, a float an
// object, so `min` and `step` read `[object Object]`, a number field refused a
// value its step allowed, and the subclasses of float, int and str did the
// same. The attributes written by name are the witness, and what Svelte writes
// for `0.5`, `1.5`, `3` and `"named"`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpreadScalars from './fixtures/SpreadScalars.svelte';

const NAMES = ['min', 'step', 'title', 'data-count', 'aria-label'];

test('a scalar spread onto an element is the attribute written by name, as it changes', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(SpreadScalars, { target });
    flushSync();

    const attributes = (key) => NAMES.map((name) => target.querySelector(`[data-k="${key}"]`).getAttribute(name));

    expect(attributes('direct')).toEqual(['0.5', '0.5', '1.5', '3', 'named']);
    expect(attributes('spread')).toEqual(attributes('direct'));

    instance.replace();
    flushSync();
    expect(attributes('spread')).toEqual(['0.25', '0.25', '1.5', '3', 'named']);
});
