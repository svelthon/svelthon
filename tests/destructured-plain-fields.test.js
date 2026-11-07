// **A field a pattern unpacks is read again where it is read**, as Svelte
// reads one in an `{#each}` or a snippet: held in a derived, it kept its first
// value until something it followed changed, so the field of an object a
// JavaScript library changes in place, the view then asked to render again,
// showed `1 → 2 → 3` where Svelte shows `1 → 3 → 5`. A positional pattern's
// row is taken apart once, as Svelte's `to_array` takes it, and its elements
// read where they are read.
//
// And so is the rest of what a snippet's parameter reads: the text that reads
// the parameter itself, which Svelte held in a derived since every Python
// expression is a call; the object a pattern takes apart by key, which was held
// too, and so was the object `[{first}]` takes at its position, which a library
// replaced in the array; and the names around a `*rest`, which were copied out
// of the array. But
// a call the author wrote is held until what it reads changes, as Svelte holds
// one: read again with the text, `read(value)` ran at every render.
import { test, expect } from 'vitest';
import { compile } from 'svelte/compiler';
import { mount, flushSync } from './mounted.js';
import { pythonExpressions } from '../src/lib/markup.js';
import DestructuredPlainFields from './fixtures/DestructuredPlainFields.svelte';
import SnippetRereads from './fixtures/SnippetRereads.svelte';
import SnippetRereadsNative from './fixtures/SnippetRereadsNative.svelte';
import { calls } from './fixtures/reread_calls.js';

// What each `[data-k]` shows once a JavaScript row was changed in place and the
// component rendered again for another reason, and how often `read` ran.
const reread = (Component) => {
    calls.length = 0;
    const rows = [{ id: 'a', value: 10, data: { first: 20 }, list: [30, 1, 2], items: [{ first: 40 }] }];
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { rows } });
    const shown = () => Object.fromEntries([...target.querySelectorAll('[data-k]')].map((one) => [one.dataset.k, one.textContent]));

    flushSync();
    rows[0].value = 11;
    rows[0].data = { first: 21 };
    rows[0].list[0] = 31;
    rows[0].items[0] = { first: 41 };
    instance.bump();
    flushSync();
    instance.bump();
    flushSync();

    const seen = { ...shown(), read: calls.length };

    target.remove();
    return seen;
};

test('a snippet’s parameter, a field by key and a name around a star are read again, as Svelte reads them', () => {
    const seen = reread(SnippetRereads);

    expect(seen).toEqual({
        'plain-a': '2:11',
        'keyed-a': '23',
        'starred-a': '33',
        'counted-a': '2:reada',
        'nested-a': '43',
        'each-a': '33',
        'each-nested-a': '43',
        read: 1
    });
    expect(seen).toEqual(reread(SnippetRereadsNative));
});

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
