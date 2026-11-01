// @vitest-environment node
//
// The server half of the whitespace of a run of `{@debug}`, in `debug-tag.test.js`.
import { test, expect, vi } from 'vitest';
import { render } from 'svelte/server';
import DebugTagRuns from './fixtures/DebugTagRuns.svelte';
import DebugTagRunsNative from './fixtures/DebugTagRunsNative.svelte';

test('a run of {@debug} leaves the whitespace Svelte leaves on a server', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
        const page = (Component) => render(Component).body.replace(/<!--[^>]*-->/g, '');
        const native = page(DebugTagRunsNative);

        expect(page(DebugTagRuns)).toBe(native);
        expect(native).toContain('<p data-k="2">A  B</p>');
    } finally {
        log.mockRestore();
    }
});
