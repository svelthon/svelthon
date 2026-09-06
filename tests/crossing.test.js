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

    // The sixth direction, and the one that used to be missing. A dict handed
    // to another module's *function* arrived as a JavaScript object — `["k"]`
    // worked, `.get()`, `.items()` and `isinstance` did not — because
    // `registerModule` puts a plain JavaScript object into `$B.imported`, so the
    // call takes Brython's interop path and converts its arguments on the way
    // in. `pyBoundary` undoes that conversion by handing back the object the
    // WeakMap recorded, rather than trying to prevent it.
    //
    // Found again from the outside: a Pronom component split into a module and
    // components, where a `.get` on a helper's argument stopped working.
    test('handed to another module as an argument', () =>
        expect(read('argument')).toBe('dict dict=True'));
});
