// **The rows of a block are computed again on a change of what computing them
// read, and only then**, as in Svelte, whose iterable follows each field it
// reads through its proxies. Through its names, the computation followed
// everything under them, so a change inside one row computed the rows again:
// `sorted(d.items())` sorted every pair again, 18 ms at 500 rows where
// Svelte's took none. What it reads inside a row, it follows (`shaped`), and
// the second half of this file is the rows computed from what is inside them,
// which must follow it.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { seen, reset } from './fixtures/counting.js';
import EachComputedRows from './fixtures/EachComputedRows.svelte';
import EachComputedRowsNative from './fixtures/EachComputedRowsNative.svelte';
import EachComputedRowsParent from './fixtures/EachComputedRowsParent.svelte';
import EachReadsInside from './fixtures/EachReadsInside.svelte';

// How often the rows were computed when mounted, after a change inside a row,
// then after a row added, and what the block showed last.
const computations = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    const counts = [];

    reset();
    mount(Component, { target, props });
    flushSync();
    counts.push(seen.rows);

    for (const name of ['grow', 'add']) {
        target.querySelector(`.${name}`).click();
        flushSync();
        counts.push(seen.rows);
    }

    target.remove();
    return counts;
};

test.for(['sorted', 'items', 'enumerate', 'comprehension'])('rows computed as %s are computed again on a row added, not on a change inside one, as in Svelte', (kind) => {
    expect(computations(EachComputedRows, { kind })).toEqual(computations(EachComputedRowsNative, { kind }));
    expect(computations(EachComputedRows, { kind })).toEqual([1, 1, 2]);
});

test('rows computed from a prop are computed again on a row added, not on a change inside one, as in Svelte', () => {
    expect(computations(EachComputedRowsParent, {})).toEqual(computations(EachComputedRowsNative, { kind: 'prop' }));
});

// What the rows are computed from inside them: a field read by a key, by a
// nested key, by `str()`, by a format, by a filter, by `len()`, `in`, an
// attribute, a comparison of lists, a key of JavaScript's, `max()`, `any()`,
// `join()`, `sum()`, `%`, a starred list, a `match`, a slice and a list's
// truth, a builtin handed an attribute, `sum(b.parts)` and `max(b.parts)`, a
// property that sums one, and a class's attribute read through an instance,
// and a key added to a row. Changed, the block shows the rows as computed now.
test.for([
    'key', 'nested', 'str', 'format', 'filter', 'length', 'member', 'boxes', 'values', 'items', 'js',
    'max', 'any', 'join', 'sum', 'percent', 'unpack', 'match', 'slice', 'truth',
    'sumattr', 'maxattr', 'property', 'classattr', 'in'
])('rows computed from what is inside them, %s, follow it', (kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(EachReadsInside, { target, props: { kind } });
    const shown = () => [...target.querySelectorAll('span')].map((one) => one.textContent).join(' ');

    flushSync();

    const before = shown();

    instance.step();
    flushSync();

    expect(shown()).toBe(instance.expected());
    expect(shown()).not.toBe(before);
    target.remove();
});
