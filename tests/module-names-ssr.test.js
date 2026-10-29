// @vitest-environment node
//
// The server half of `module-names.test.js`: the module's name a server
// renders is the module's, where it rendered the instance's `0`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import ModuleShadowed from './fixtures/ModuleShadowed.svelte';

test("a server renders a module's name as the module holds it", () => {
    expect(render(ModuleShadowed).body.replace(/<!--[^>]*-->/g, '')).toBe('<output>41</output>');
});
