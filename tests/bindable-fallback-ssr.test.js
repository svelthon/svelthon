// @vitest-environment node
//
// The server half of `bindable-fallback.test.js`: a server reads a fallback as
// the props are destructured, before init() has written the default, and a
// bindable prop the parent leaves `undefined` still renders its default.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import BindableFallback from './fixtures/BindableFallback.svelte';
import BindableFallbackNative from './fixtures/BindableFallbackNative.svelte';
import BindableFallbackHost from './fixtures/BindableFallbackHost.svelte';

const shown = (Component, props) => render(Component, { props }).body.replace(/<!--[^>]*-->/g, '');

test.for([
    ['with no parent', null, {}],
    ['passed nothing', BindableFallbackHost, { bound: false, start: undefined }],
    ['bound to nothing', BindableFallbackHost, { bound: true, start: undefined }]
])('a default %s renders on a server, as a Svelte child does', ([, Host, props]) => {
    const render = (Child) => (Host === null ? shown(Child, {}) : shown(Host, { ...props, Child }));
    const native = render(BindableFallbackNative);

    expect(native).toContain('<p data-k="child">default</p>');
    expect(render(BindableFallback)).toBe(native);
});
