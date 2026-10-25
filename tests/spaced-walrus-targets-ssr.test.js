// @vitest-environment node
//
// The server half of `spaced-walrus-targets.test.js`: a template `:=` whose
// target is spaced before its dot or its bracket compiles for the server too,
// where it was refused as Python's own walrus.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import SpacedWalrusTargets from './fixtures/SpacedWalrusTargets.svelte';

test('the server renders a component whose template walrus targets are spaced', () => {
    expect(render(SpacedWalrusTargets).body).toContain(`<output>${Array(8).fill('before').join('|')}</output>`);
});
