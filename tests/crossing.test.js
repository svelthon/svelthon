import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Crossing from './fixtures/Crossing.svelte';

// A dict, asked what it has become at each place it can cross out of the module
// that made it.
describe('a dict crossing a module boundary', () => {
    const read = (k) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Crossing, { target });
        flushSync();
        return target.querySelector(`p[data-k="${k}"]`).textContent;
    };

    test('where it was made', () => expect(read('local')).toBe('dict dict=True'));
    test('read back out of another module', () => expect(read('read')).toBe('dict dict=True'));
    test('returned by another module', () => expect(read('returned')).toBe('dict dict=True'));
    test('passed down as a component prop', () => expect(read('prop')).toBe('dict dict=True'));

    // The sixth direction is missing on purpose. A dict handed to another
    // module's *function* arrives as a JavaScript object — `["k"]` works,
    // `.get()`, `.items()` and `isinstance` do not — because `registerModule`
    // puts a plain JavaScript object into `$B.imported`, so the call takes
    // Brython's interop path and converts its arguments on the way in. The
    // fixture still renders it under `data-k="argument"`, ready to assert the
    // day it is fixed.
});
