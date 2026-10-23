// @vitest-environment node
//
// The server half of `variant-bodies.test.js`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import VariantHost from './fixtures/VariantHost.svelte';

test('two variants of one file each render their own Python on a server, as in Svelte', () => {
    const [python, native] = render(VariantHost)
        .body.replace(/<!--[^>]*-->/g, '')
        .match(/<div class="(?:python|native)">.*?<\/div>/g);

    expect(native).toBe('<div class="native"><output>alpha</output><output>beta</output></div>');
    expect(python).toBe(native.replace('native', 'python'));
});
