// An iterable a builtin makes as it goes, a `range`, a dict's view, a generator,
// `map`, `zip`, `enumerate`, `filter`, `reversed`, holds none of its items where
// JavaScript looks: handed to a JavaScript child as the Brython object it is,
// `<Chart labels={data.keys()} />`, the child's `{#each}` rendered nothing and
// nothing said so, where the Python template walks every one of them. It goes
// out as the list `list()` makes of it, and so does one a dict or a list holds,
// `data={{"labels": d.keys()}}`, read by the child through the container's view.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ListedLazy from './fixtures/ListedLazy.svelte';

test('a JavaScript child reads a lazy iterable as the list list() makes of it, alone or held', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(ListedLazy, { target });
    flushSync();

    const shown = (k) => [...target.querySelectorAll(`[data-k="${k}"] p`)].map((one) => one.textContent);

    expect([shown('lazy'), shown('in-dict'), shown('in-list')]).toEqual([shown('listed'), shown('listed'), shown('listed')]);
    expect(shown('lazy')[0]).toBe('true 0;1;2;');
});
