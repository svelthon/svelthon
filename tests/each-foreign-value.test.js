// **`{#each}` walks a JavaScript value as Svelte walks it**: an array, an
// iterable, and an object with a `length` by its items, `Array.from`, which
// is what Svelte's documentation and its block say; an object with neither
// walks nothing. Taken for a mapping, an object walked its keys, and an
// array-like `{length: 2, 0: "x", 1: "y"}` showed `0, 1, length`. The
// script's `for` is Python's, and keeps the keys. The witness is the same
// block in Svelte.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import EachForeignValue from './fixtures/EachForeignValue.svelte';
import EachForeignValueNative from './fixtures/EachForeignValueNative.svelte';

const shown = (Component, data) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target, props: { data } });
    flushSync();

    const rows = [...target.querySelectorAll('.each i')].map((one) => one.textContent);
    const script = target.querySelector('.script')?.textContent;

    target.remove();
    return { rows, script };
};

const VALUES = {
    object: () => ({ a: 1, b: 2 }),
    arraylike: () => ({ length: 2, 0: 'x', 1: 'y' }),
    marked: () => ({ ob_type: 'business', value: 42 }),
    set: () => new Set(['x', 'y']),
    array: () => ['x', 'y']
};

test.for(Object.keys(VALUES))('a JavaScript %s walked by {#each} gives the rows Svelte gives', (name) => {
    expect(shown(EachForeignValue, VALUES[name]()).rows).toEqual(shown(EachForeignValueNative, VALUES[name]()).rows);
});

test("the script's for walks an object's keys, as Python walks a mapping", () => {
    expect(shown(EachForeignValue, VALUES.object()).script).toBe('a b');
    expect(shown(EachForeignValue, VALUES.arraylike()).script).toBe('0 1 length');
});
