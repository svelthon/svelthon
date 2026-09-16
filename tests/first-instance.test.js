// The first object of its kind that the runtime ever watches.
//
// The instance dictionary was found by *discovery*: scan an object's symbols
// once, keep the one called `DICT`, and skip arrays so a plain list does not pay
// for the scan. A list subclass is an array **and** carries that dictionary, so
// it could never teach the symbol to the runtime — and if it was the first such
// object watched, the symbol was never learned at all and its attributes were
// never walked.
//
// That made the watch depend on **mount order**: the same component repainted or
// not according to whether some ordinary instance had been watched before it.
// Brython publishes the symbol as `$B.DICT`, so there is nothing to discover.
//
// This file is deliberately alone with one fixture: a test that shares a file
// with an ordinary instance has the symbol taught to it by that neighbour, which
// is exactly how the defect hid in `tests/attribute-reach.test.js`.
//
// The mutation goes through an alias kept in a closure and the reading through
// `vars()`, so `box.rows` is never read again: the handover that `$getattr` does
// at read time cannot cover this, and the initial walk is the only route left.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import AliasedSubclass from './fixtures/AliasedSubclass.svelte';

test('a list subclass is watched even when nothing taught the runtime its shape', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(AliasedSubclass, { target });
    flushSync();

    const read = () => target.querySelector('[data-k="total"]').textContent;

    expect(read()).toBe('0');

    target.querySelector('button[data-k="go"]').click();
    flushSync();

    expect(read()).toBe('1');
});
