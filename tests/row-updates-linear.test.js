// Updating every row of a watched table costs what the rows are, not their
// square. A mutation checks that each link it crosses still holds, and that
// check reads the one entry the row entered under, not the whole table: 10,000
// rows of a dict took seconds when it read them all, once per row.
//
// The bound is absolute and generous, as in `markup-linear.test.js`: the
// quadratic walk is two orders of magnitude above it.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import RowTable from './fixtures/RowTable.svelte';

test.for(['dict', 'list'])('marking every row of a %s of 10,000 is linear', (kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(RowTable, { target, props: { kind } });
    flushSync();

    const started = performance.now();
    target.querySelector('button').click();
    flushSync();
    const spent = performance.now() - started;

    expect(target.querySelector('p').textContent).toBe('10000');
    expect(spent).toBeLessThan(1000);
});
