// @vitest-environment node
//
// The server half of `spaced-equals.test.js`: with whitespace before the `=`,
// an empty list is false, so neither `disabled` nor `hidden` is written.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import SpacedEquals from './fixtures/SpacedEquals.svelte';

test('a server reads an attribute with whitespace before its `=` as written', () => {
    const html = render(SpacedEquals).body;

    expect([html.includes('disabled=""'), html.includes('hidden=""'), html.includes('value="Ada"'), html.includes('color: blue')]).toEqual([
        false,
        false,
        true,
        true
    ]);
});
