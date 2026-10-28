// @vitest-environment node
//
// The server half of `positional-python-iterables.test.js`: the server takes
// a Python iterable apart as Python does too, where it rendered `:`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import PositionalPythonIterables from './fixtures/PositionalPythonIterables.svelte';

test('the server takes a Python iterable apart as Python does', () => {
    const body = render(PositionalPythonIterables).body;

    expect(Object.fromEntries([...body.matchAll(/<output data-k="([^"]*)">([^<]*)<\/output>/g)].map((one) => [one[1], one[2]]))).toEqual({
        range: '10:20',
        generator: '10:20',
        iterator: '10:20',
        instance: '10:20',
        list: '10:20'
    });
});
