// @vitest-environment node
//
// The server half of `keyed-deferred-defaults.test.js`: the server renders the
// same rows, where the key is not computed, so the two halves read one answer.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import KeyedDeferredDefaults from './fixtures/KeyedDeferredDefaults.svelte';

test('the server renders a keyed each whose defaults wait for the row', () => {
    const body = render(KeyedDeferredDefaults).body;
    const read = (key) => [...body.matchAll(new RegExp(`<output data-k="${key}">([^<]*)</output>`, 'g'))].map((one) => one[1]);

    expect(['pairs', 'pattern', 'braces', 'starred'].map(read)).toEqual([
        ['3:3', '4:9', '5:5', '6:'],
        ['3:4'],
        ['3:6'],
        ['3:2:3']
    ]);
});
