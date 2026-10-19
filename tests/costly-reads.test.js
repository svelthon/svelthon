// **A name whose read runs code is read where Python reads it**: a snippet's
// default, a name a pattern unpacks, a derived. Handed to the expression ahead,
// it ran before what the expression reads to its left, `{first() + ":" + x}`
// running `x`'s default before `first()`; and the write half of a binding read
// it ahead too, so `bind:value={bag[0 if True else x]}` ran the default a
// branch excluded, raised, and lost what was typed. The order and the answers
// are CPython's, and Svelte's in production.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ReadOrder from './fixtures/ReadOrder.svelte';
import BoundBranch from './fixtures/BoundBranch.svelte';
import { seen } from './fixtures/read_order.js';

test.for([
    ['default', 'first@1:second@2', ['first', 'second']],
    // In the order the body reads them, `y` first, and not the parameters'.
    ['two defaults', 'first@1:second@2', ['first', 'second']]
])('a default is read in the order the expression reads it: %s', ([kind, shown, order]) => {
    const target = document.body.appendChild(document.createElement('div'));

    seen.length = 0;
    mount(ReadOrder, { target, props: { kind } });
    flushSync();

    expect([target.querySelector('output').textContent, [...seen]]).toEqual([shown, order]);
});

test.for(['if', 'and'])('a binding whose target skips a default writes what is typed: %s', ([kind]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(BoundBranch, { target, props: { kind } });
    flushSync();

    const input = target.querySelector('input');

    input.value = 'new';
    input.dispatchEvent(new Event('input'));
    flushSync();

    expect(target.querySelector('output').textContent).toBe('new');
});
