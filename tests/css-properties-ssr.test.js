// @vitest-environment node
//
// The server half of `css-properties.test.js`: the wrapper a server writes
// around a Python child holds the number, where it held `[object Object]`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import CssRates from './fixtures/CssRates.svelte';

test('a server writes a CSS custom property on a Python child as the number', () => {
    const html = render(CssRates).body;

    expect([...html.matchAll(/--rate:\s*([^;"]+)/g)].map((found) => found[1].trim())).toEqual(Array(4).fill('0.5'));
});
