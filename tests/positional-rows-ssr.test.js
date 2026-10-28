// @vitest-environment node
//
// The server half of `positional-rows.test.js`: the server takes a row Python
// iterates apart by position too, where it raised `object is not iterable`.
// A pending `{#await}` renders nothing on the server, as Svelte renders it.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import PositionalRows from './fixtures/PositionalRows.svelte';

test('the server takes a row Python iterates apart by position', () => {
    const body = render(PositionalRows).body;

    expect(Object.fromEntries([...body.matchAll(/<output data-k="([^"]*)">([^<]*)<\/output>/g)].map((one) => [one[1], one[2]]))).toEqual({
        'each-range': '10:20',
        'each-generator': '10:20',
        'each-iterator': '10:20',
        'each-instance': '10:20',
        'keyed-0': '10:20',
        'keyed-1': '30:40',
        'starred-0': '10:20',
        'starred-1': '30:40',
        nested: '10:20'
    });
});
