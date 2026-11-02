// @vitest-environment node
//
// The server half of `template-typo.test.js`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import TemplateTypo from './fixtures/TemplateTypo.svelte';

test('a typo in the template raises NameError at its line on a server', () => {
    expect(() => render(TemplateTypo).body).toThrow(/NameError: name 'conut' is not defined .*TemplateTypo\.svelte:6/);
});
