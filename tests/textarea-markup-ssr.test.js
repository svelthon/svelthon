// @vitest-environment node
//
// The server half of the textarea cases of `component-blocks.test.js`: the
// markup written as a textarea's text is rendered as that text, and a closing
// tag in another case ends it.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import TextareaMarkup from './fixtures/TextareaMarkup.svelte';
import TextareaCasedClose from './fixtures/TextareaCasedClose.svelte';

test("a server renders a textarea's markup as its text", () => {
    const html = render(TextareaMarkup).body;

    expect([html.includes('&lt;Card />'), html.includes('&lt;input disabled=Ada />'), html.includes('&lt;div hidden=Ada>text&lt;/div>')]).toEqual([
        true,
        true,
        true
    ]);
});

test('a server ends a textarea closed in another case where Svelte ends it', () => {
    const html = render(TextareaCasedClose).body;

    expect([html.includes('disabled'), html.includes('checked')]).toEqual([false, false]);
});
