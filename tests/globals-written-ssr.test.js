// @vitest-environment node
//
// The server half of `globals-written.test.js`: what the module's body wrote is
// rendered, and a block that reads a name nothing has written yet does not run.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import GlobalsWritten from './fixtures/GlobalsWritten.svelte';
import GlobalsThroughFunctions from './fixtures/GlobalsThroughFunctions.svelte';
import GlobalsBesideStar from './fixtures/GlobalsBesideStar.svelte';
import GlobalsPrototypeNames from './fixtures/GlobalsPrototypeNames.svelte';

test('a server renders a name only globals() binds', () => {
    expect(render(GlobalsWritten).body.replace(/<!--[^>]*-->/g, '')).toContain('1|6||1');
});

test('through a function, a @derived and a =>', () => {
    expect(render(GlobalsThroughFunctions).body).toContain('1|1|1');
});

test('beside a star import', () => {
    expect(render(GlobalsBesideStar).body).toContain('1|1|7|7|[1]');
});

test("a name of JavaScript's prototype", () => {
    expect(render(GlobalsPrototypeNames).body).toContain("1|2|name 'valueOf' is not defined");
});
