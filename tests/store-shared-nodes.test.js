import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SharedRowsReader from './fixtures/SharedRowsReader.svelte';
import { store } from './fixtures/shared_rows.svelte.py';

// One object a store holds is one object wherever it holds it, under a new
// array or a second name, as one object is one proxy of Svelte's: written
// through any of them, it is written for all, Python's reads and the pages'.
// Each array the store was handed held its own copy, and Python's first read
// copied the row a proxy still held: the write was lost.

test('a row JavaScript keeps is the row of the array it is put back in', () => {
    store.rows = [{ n: 1 }];

    const row = store.rows[0];

    store.rows = [row];
    expect(store.total()).toBe(1);

    row.n = 5;

    expect([store.total(), store.rows[0].n]).toEqual([5, 5]);
});

test('a row under two names is written for both', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const shown = () => [...target.querySelectorAll('p')].map((p) => p.textContent);

    store.rows = [{ n: 1 }];
    store.meta = { other: [] };
    mount(SharedRowsReader, { target });
    flushSync();

    store.meta.other.push(store.rows[0]);
    flushSync();
    store.meta.other[0].n = 7;
    flushSync();

    expect([shown(), store.rows[0].n, store.total()]).toEqual([['7', '7'], 7, 7]);
});
