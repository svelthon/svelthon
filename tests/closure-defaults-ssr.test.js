// @vitest-environment node
//
// The server half of `closure-defaults.test.js`: the server renders a function
// a default makes reading a later name once it is bound, where it raised.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import ClosureDefaults from './fixtures/ClosureDefaults.svelte';

test('the server reads a later name through a function a default makes', () => {
    const body = render(ClosureDefaults, { props: { given: [undefined, 7] } }).body;

    expect(Object.fromEntries([...body.matchAll(/<output data-k="([^"]*)">([^<]*)<\/output>/g)].map((one) => [one[1], one[2]]))).toEqual({
        'snippet-both': '7:7',
        'snippet-given': '7:7',
        'each-both': '7:7',
        'each-given': '7:7'
    });
});
