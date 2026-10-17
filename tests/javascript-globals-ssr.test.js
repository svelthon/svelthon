// @vitest-environment node
//
// The server half of `javascript-globals.test.js`: a server writes a bindable
// prop's default as the props are destructured, through the same setter.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import GlobalsBindable from './fixtures/GlobalsBindable.svelte';
import GlobalsBindableFunction from './fixtures/GlobalsBindableFunction.svelte';
import GlobalsBindableNative from './fixtures/GlobalsBindableNative.svelte';

const shown = (Component) => render(Component).body.replace(/<!--[^>]*-->/g, '');

test('a bindable prop renders on a server beside a module binding Object, as in Svelte', () => {
    expect(shown(GlobalsBindableNative)).toBe('<output>7</output>');
    expect(shown(GlobalsBindable)).toBe(shown(GlobalsBindableNative));
    expect(shown(GlobalsBindableFunction)).toBe('<output></output>');
});
