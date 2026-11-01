// @vitest-environment node
//
// The server half of `globals-written.test.js`: what the module's body wrote is
// rendered, and a name nothing has bound yet renders as nothing.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import GlobalsWritten from './fixtures/GlobalsWritten.svelte';

test('a server renders a name only globals() binds', () => {
    expect(render(GlobalsWritten).body).toContain('1|6||1');
});
