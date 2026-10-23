// @vitest-environment node
//
// The server half of `rune-named-props.test.js`: a server read `$state` as the
// `state` store before the prop was declared, and rendered nothing.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import RuneNamedProps from './fixtures/RuneNamedProps.svelte';
import RuneNamedPropsNative from './fixtures/RuneNamedPropsNative.svelte';
import RuneNamedPropsHost from './fixtures/RuneNamedPropsHost.svelte';

const shown = (Child) => render(RuneNamedPropsHost, { props: { Child } }).body.replace(/<!--[^>]*-->/g, '');

test('bindable props named like runes render on a server, as in Svelte', () => {
    const native = shown(RuneNamedPropsNative);

    expect(native).toContain('<output>5|2|7</output>');
    expect(shown(RuneNamedProps)).toBe(native);
});
