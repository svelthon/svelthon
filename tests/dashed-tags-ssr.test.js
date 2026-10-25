// @vitest-environment node
//
// The server half of `dashed-tags.test.js`: a tag a capital starts that holds
// a dash is rendered as an element on the server too, where its name was read
// as Python and the render failed with a `NameError`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import DashedTags from './fixtures/DashedTags.svelte';

test('the server renders a tag a capital starts that holds a dash as an element', () => {
    const body = render(DashedTags).body;

    expect([...body.matchAll(/<([\w-]+) data-k="[^"]*" title="before">ok<\/\1>/gi)].map((one) => one[1].toLowerCase())).toEqual([
        'dashed-tag',
        'dashed-tag',
        'dashed-tag',
        'dashed-long-tag'
    ]);
});
