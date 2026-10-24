// @vitest-environment node
//
// The server half of `snippet-parameter-names.test.js`: a snippet whose own
// scope binds its name renders on the server too, where it failed with
// `Cannot access 'row' before initialization`, and one whose body declares a
// snippet of its name is handed Python values by a Python child.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import SnippetSelfNamed from './fixtures/SnippetSelfNamed.svelte';
import SnippetSelfNested from './fixtures/SnippetSelfNested.svelte';

const shown = (Component) => [...render(Component).body.matchAll(/<output>(.*?)<\/output>/g)].map((one) => one[1]);

test('the server renders a snippet whose own scope binds its name', () => {
    expect(shown(SnippetSelfNamed)).toEqual(Array(10).fill('ok'));
});

test('the server hands Python values to a snippet whose body declares a snippet of its name', () => {
    expect(shown(SnippetSelfNested)).toEqual(['float', 'Price', 'Label']);
});
