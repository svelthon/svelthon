// @vitest-environment node
//
// The server half of the textarea case of `component-blocks.test.js`: the
// markup written as a textarea's text is rendered as that text.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import TextareaMarkup from './fixtures/TextareaMarkup.svelte';

test("a server renders a textarea's markup as its text", () => {
    const html = render(TextareaMarkup).body;

    expect([html.includes('&lt;Card />'), html.includes('&lt;input disabled=Ada />'), html.includes('&lt;div hidden=Ada>text&lt;/div>')]).toEqual([
        true,
        true,
        true
    ]);
});
