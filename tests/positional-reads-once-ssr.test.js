// @vitest-environment node
//
// The server half of `positional-reads-once.test.js`: the server reads a
// snippet's positional pattern as far as its positions, each element once.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import { props, EXPECTED } from './positional-reads-once.js';
import PositionalReadsOnce from './fixtures/PositionalReadsOnce.svelte';

test('the server reads a positional pattern as far as its positions, and each element once', () => {
    const body = render(PositionalReadsOnce, { props: props() }).body;

    expect(Object.fromEntries([...body.matchAll(/<output data-k="([^"]*)">([^<]*)<\/output>/g)].map((one) => [one[1], one[2]]))).toEqual(
        EXPECTED
    );
});
