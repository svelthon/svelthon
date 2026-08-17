import { test, expect } from 'vitest';
import { mount } from 'svelte';
import Semantics from './Semantics.svelte';

// Each of these is wrong under JavaScript semantics, so passing them means the
// component really ran through CPython's grammar and Brython's object model —
// not something that merely looks like Python.
test('components run real Python semantics', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Semantics, { target });

    const value = (k) => target.querySelector(`[data-k="${k}"]`).textContent;

    expect(value('floor')).toBe('-4');                     // JS: Math.trunc(-3.5) === -3
    expect(value('big')).toBe('1180591620717411303424');   // JS: 1.1805916207174113e+21
    expect(value('words')).toBe('apple, apricot, banana'); // a sorted set, not an object
});
