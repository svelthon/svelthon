// @vitest-environment node
//
// The server half of the glued case of `no-space-attribute.test.js`: an empty
// list is false after a spread or an attachment too, so neither `disabled` nor
// `hidden` nor the class is written.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import GluedAttributes from './fixtures/GluedAttributes.svelte';

test('a server reads an attribute glued to a spread or an attachment as written', () => {
    const html = render(GluedAttributes).body;

    expect([html.includes('disabled=""'), html.includes('hidden=""'), html.includes('class="active"'), html.includes('title="literal"')]).toEqual([
        false,
        false,
        false,
        true
    ]);
});
