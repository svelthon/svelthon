// @vitest-environment node
//
// The server half of `foreign-nan-select.test.js`: a multiple select bound to a
// JavaScript array holding a NaN renders on a server, as Svelte's does.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import ForeignNanSelect from './fixtures/ForeignNanSelect.svelte';
import ForeignNanSelectNative from './fixtures/ForeignNanSelectNative.svelte';

test('a multiple select over a JavaScript array holding a NaN renders on a server as Svelte renders it', () => {
    expect(render(ForeignNanSelect).body).toBe(render(ForeignNanSelectNative).body);
});
