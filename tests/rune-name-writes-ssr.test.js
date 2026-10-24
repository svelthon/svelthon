// @vitest-environment node
//
// The server half of `rune-name-writes.test.js`: a derived written at the top
// of the script past its declaration renders the value written, as Svelte's
// does. The render failed with `TypeError: 'int' object is not callable`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import DerivedWritesServer from './fixtures/DerivedWritesServer.svelte';
import DerivedWritesServerNative from './fixtures/DerivedWritesServerNative.svelte';

test('the server renders a derived written past its declaration as the value written', () => {
    const shown = (Component) => render(Component).body.match(/<output>(.*?)<\/output>/)[1];

    expect(shown(DerivedWritesServerNative)).toBe('99 99 99');
    expect(shown(DerivedWritesServer)).toBe(shown(DerivedWritesServerNative));
});
