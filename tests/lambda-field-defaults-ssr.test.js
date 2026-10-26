// @vitest-environment node
//
// The server half of `lambda-field-defaults.test.js`: the server compiles a
// bare lambda as a field's default too, where the same cut was refused.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import LambdaFieldDefaults from './fixtures/LambdaFieldDefaults.svelte';

test('the server renders fields unpacked by key whose default is a bare lambda', () => {
    const body = render(LambdaFieldDefaults).body;

    expect(Object.fromEntries([...body.matchAll(/<output data-k="([^"]*)">([^<]*)<\/output>/g)].map((one) => [one[1], one[2]]))).toEqual({
        'each-none': '1',
        'each-one': '3',
        'each-two': '6',
        'each-renamed': '1',
        'snippet-none': '1',
        'snippet-one': '3',
        'snippet-two': '6'
    });
});
