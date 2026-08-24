// @vitest-environment node
//
// Off a browser there is no parser, and `striptags` returns nothing rather than
// something wrong: a first render shows less and then shows the text, instead of
// showing `caf&eacute;` and correcting it after hydration.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import Stripped from './fixtures/Stripped.svelte';

test('under server rendering it yields nothing', () => {
    expect(typeof globalThis.DOMParser).toBe('undefined');

    const html = render(Stripped).body;

    expect(html).not.toContain('Bonjour le monde');
    expect(html).not.toContain('caf&amp;eacute;');
    expect(html).toContain('data-k="out-0"');
});
