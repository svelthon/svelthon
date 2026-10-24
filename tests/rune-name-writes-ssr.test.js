// @vitest-environment node
//
// The server half of `rune-name-writes.test.js`: a derived written at the top
// of the script past its declaration renders the value written, as Svelte's
// does. The render failed with `TypeError: 'int' object is not callable`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import DerivedWritesServer from './fixtures/DerivedWritesServer.svelte';
import DerivedWritesServerNative from './fixtures/DerivedWritesServerNative.svelte';
import DerivedDeclarations from './fixtures/DerivedDeclarations.svelte';
import DerivedDeclarationsNative from './fixtures/DerivedDeclarationsNative.svelte';
import RuneWalrus from './fixtures/RuneWalrus.svelte';

test('the server renders a derived written past its declaration as the value written', () => {
    const shown = (Component) => render(Component).body.match(/<output>(.*?)<\/output>/)[1];

    expect(shown(DerivedWritesServerNative)).toBe('99 99 99');
    expect(shown(DerivedWritesServer)).toBe(shown(DerivedWritesServerNative));
});

// And a declaration told from a decorator's write above its marker, from its
// second target and from a write it makes before its binding.
test('the server tells a declaration from the writes beside it, as Svelte does', () => {
    const shown = (Component) => render(Component).body.match(/<p data-k="shown">(.*?)<\/p>/)[1];

    expect(shown(DerivedDeclarationsNative)).toBe('99 2 3 3 4');
    expect(shown(DerivedDeclarations)).toBe(shown(DerivedDeclarationsNative));
});

// And a `:=` of the name inside its own declaration, which the declaration's
// binding writes over: the server rendered the value of the `:=`, or the
// function it was given back.
test('the server renders a derived whose declaration holds a := of its name as its result', () => {
    expect(render(RuneWalrus).body.match(/<p data-k="shown">(.*?)<\/p>/)[1]).toBe('2 3 4 4');
});
