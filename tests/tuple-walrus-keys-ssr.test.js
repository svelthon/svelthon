// @vitest-environment node
//
// The server half of `tuple-walrus-keys.test.js`: a template `:=` whose key is
// a tuple with a trailing comma compiles for the server too, where `grid[1,]`
// was emitted as `1,,` and refused.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import TupleWalrusKeys from './fixtures/TupleWalrusKeys.svelte';

test('the server renders a component whose template walrus keys are tuples', () => {
    expect(render(TupleWalrusKeys).body).toContain(`<output>${Array(12).fill('before,sentinel,2').join('|')}</output>`);
});
