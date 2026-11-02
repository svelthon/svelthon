// @vitest-environment node
//
// The server half of `spaced-equals.test.js`: with whitespace before the `=`,
// an empty list is false, so neither `disabled` nor `hidden` is written.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import SpacedEquals from './fixtures/SpacedEquals.svelte';
import SpacedValueNames from './fixtures/SpacedValueNames.svelte';
import SpacedValueNamesNative from './fixtures/SpacedValueNamesNative.svelte';

test('a server reads an attribute with whitespace before its `=` as written', () => {
    const html = render(SpacedEquals).body;

    expect([html.includes('disabled=""'), html.includes('hidden=""'), html.includes('value="Ada"'), html.includes('color: blue')]).toEqual([
        false,
        false,
        true,
        true
    ]);
});

// And a value set apart from its `=` names no attribute: taken for the
// shorthand `{checked}`, the box was crossed without its `checked`.
test('a server reads a value set apart from its `=` as Svelte does', () => {
    const [python, svelte] = [SpacedValueNames, SpacedValueNamesNative].map((Component) =>
        render(Component).body.replace(/<!--[^>]*-->/g, '')
    );

    expect(python).toBe(svelte);
});
