// @vitest-environment node
//
// The server half of `commented-walrus.test.js`: a component whose handler
// walrus a comment or a continuation runs through compiles for the server too,
// where it was refused before any handler ran.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import CommentedWalrus from './fixtures/CommentedWalrus.svelte';

test('the server renders a component whose handler walrus holds comments', () => {
    expect(render(CommentedWalrus).body).toContain('<output>0</output>');
});
