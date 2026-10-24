// @vitest-environment node
//
// The server half of `snippet-parameter-names.test.js`: a snippet whose
// parameter carries its name renders on the server too, where it failed with
// `Cannot access 'row' before initialization`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import SnippetSelfNamed from './fixtures/SnippetSelfNamed.svelte';

test('the server renders a snippet whose parameter carries its name', () => {
    expect([...render(SnippetSelfNamed).body.matchAll(/<output>(.*?)<\/output>/g)].map((one) => one[1])).toEqual(
        Array(7).fill('ok')
    );
});
