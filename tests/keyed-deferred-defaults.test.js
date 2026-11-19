// **A keyed `{#each}` reads the names a waiting default binds**, as its block
// does: a default after a row unpacked by key or around a star is held as
// `missing` and `fallback`, with no `read`, and `eachKey` read only `read`, so
// the key's Python held the word `undefined`, and the block did not mount:
// `NameError: name 'undefined' is not defined`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import KeyedDeferredDefaults from './fixtures/KeyedDeferredDefaults.svelte';
import NoneDefaults from './fixtures/NoneDefaults.svelte';
import NoneDefaultsNative from './fixtures/NoneDefaultsNative.svelte';

test('a keyed each mounts and keys its rows by the names a waiting default binds', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(KeyedDeferredDefaults, { target });
    flushSync();

    const read = (key) => [...target.querySelectorAll(`[data-k="${key}"]`)].map((one) => one.textContent);
    const before = [...target.querySelectorAll('[data-k="pairs"]')];

    expect(['pairs', 'pattern', 'braces', 'starred'].map(read)).toEqual([
        ['3:3', '4:9', '5:5', '6:'],
        ['3:4'],
        ['3:6'],
        ['3:2:3']
    ]);

    instance.reorder();
    flushSync();

    const after = [...target.querySelectorAll('[data-k="pairs"]')];

    expect(read('pairs')).toEqual(['4:9', '3:3', '6:', '5:5', '7:7']);
    // Each row kept its node, told by its key, the default's value among them.
    expect(after.slice(0, 4)).toEqual([before[1], before[0], before[3], before[2]]);
});

// And a row holding None takes the default, as Svelte takes it for `undefined`,
// by position and by key: None is `undefined` at every door, where the pattern
// held it as a value and showed `5:`. A snippet's parameter as well, which
// showed nothing for `{@render line(None)}`.
test('a pattern’s default stands in for None, as Svelte’s does for undefined', () => {
    const read = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(Component, { target });
        flushSync();

        return ['pairs', 'keyed', 'param'].map((key) => [...target.querySelectorAll(`[data-k="${key}"]`)].map((one) => one.textContent));
    };

    expect([read(NoneDefaults), read(NoneDefaultsNative)]).toEqual([
        [['5:5', '6:7'], ['1', '2'], ['7', '3']],
        [['5:5', '6:7'], ['1', '2'], ['7', '3']]
    ]);
});
