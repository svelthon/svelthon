// @vitest-environment node
//
// The server half of `default-tokens.test.js`: a second row's default leaves
// the functions the first row made be on the server too, where it raised.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import DefaultTokens from './fixtures/DefaultTokens.svelte';
import { capturing } from './default-tokens.js';

test('the server takes each default under a token of its own', () => {
    const { answers, capture } = capturing();
    const body = render(DefaultTokens, { props: { capture, source: [undefined, 10] } }).body;
    const read = (key) => [...body.matchAll(new RegExp(`<output data-k="${key}">([^<]*)</output>`, 'g'))].map((one) => one[1]);

    expect([read('rows'), read('calls'), answers.map(Number), read('refresh')]).toEqual([
        ['7:7', '7:7'],
        ['7:7', '7:7'],
        [7, 7, 7],
        ['10']
    ]);
});
