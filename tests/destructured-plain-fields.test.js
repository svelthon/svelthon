// **A field a pattern unpacks is read again where it is read**, as Svelte
// reads one in an `{#each}` or a snippet: held in a derived, it kept its first
// value until something it followed changed, so the field of an object a
// JavaScript library changes in place, the view then asked to render again,
// showed `1 → 2 → 3` where Svelte shows `1 → 3 → 5`. A positional pattern's
// row is taken apart once, as Svelte's `to_array` takes it, and its elements
// read where they are read.
import { test, expect } from 'vitest';
import { compile } from 'svelte/compiler';
import { mount, flushSync } from './mounted.js';
import { pythonExpressions } from '../src/lib/markup.js';
import DestructuredPlainFields from './fixtures/DestructuredPlainFields.svelte';

const KEYS = ['snippet-key', 'snippet-nested', 'snippet-index', 'each-key'];

// The same rows held as plain fields, or behind getters that read what the
// library holds.
const plain = () => {
    const rows = { source: { value: 1 }, nested: { item: { value: 1 } }, pair: [1] };
    const set = (value) => {
        rows.source.value = value;
        rows.nested.item.value = value;
        rows.pair[0] = value;
    };

    return { rows, set };
};

const getters = () => {
    let current = 1;
    const field = { get value() { return current; } };
    const rows = { source: field, nested: { item: field }, pair: [1] };
    const set = (value) => {
        current = value;
        rows.pair[0] = value;
    };

    return { rows, set };
};

test.for([
    ['plain fields', plain],
    ['getters', getters]
])('a field unpacked from an object changed in place is read as it is, with %s', ([, made]) => {
    const { rows, set } = made();
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(DestructuredPlainFields, { target, props: rows });
    flushSync();

    const read = () => KEYS.map((key) => target.querySelector(`[data-k="${key}"]`).textContent);
    const seen = [read()];

    for (const value of [2, 3]) {
        set(value);
        instance.advance();
        flushSync();
        seen.push(read());
    }

    expect(seen).toEqual([KEYS.map(() => '1'), KEYS.map(() => '3'), KEYS.map(() => '5')]);
});

// A field read where it is written is no cell, and binding one is refused, as
// Svelte refuses its own, `each_item_invalid_assignment`, under the name of
// what the field is unpacked from.
test('binding a field an {#each} unpacks is refused, as Svelte refuses it', () => {
    let n = 0;
    const collect = () => `__expr_${n++}`;

    const native = '<script>let { rows } = $props();</script>{#each rows as {value}}<input bind:value={value}>{/each}';

    expect(() => compile(native, { runes: true })).toThrow(
        /each_item_invalid_assignment|Cannot reassign or bind to each block argument/
    );
    expect(() => pythonExpressions('{#each rows as {value}}<input bind:value={value}>{/each}', collect)).toThrow(
        /`value` is unpacked from a row of its `\{#each\}`/
    );
});
