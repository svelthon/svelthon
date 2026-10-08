// @vitest-environment node
//
// The server half: what a Python component renders under Node, with no DOM.
// The template's rules hold on the server as in the browser: Python's truth on
// boolean attributes and on `class`, keys by identity, a JavaScript float read
// as a Python one. The HTML is pinned because the hydration test reads it.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import PythonTruthAttributes from './fixtures/PythonTruthAttributes.svelte';
import KeyIdentity from './fixtures/KeyIdentity.svelte';
import SvelteConstructs from './fixtures/SvelteConstructs.svelte';
import ScalarProps from './fixtures/ScalarProps.svelte';
import GroupHydrate from './fixtures/GroupHydrate.svelte';
import GroupServer from './fixtures/GroupServer.svelte';
import GroupServerNative from './fixtures/GroupServerNative.svelte';
import GroupValueShapes from './fixtures/GroupValueShapes.svelte';
import GroupValueShapesNative from './fixtures/GroupValueShapesNative.svelte';
import * as html from './fixtures/python-ssr-html.js';

test.for([
    ['Python truth on attributes and class', PythonTruthAttributes, {}, 'PythonTruthAttributes'],
    ['keys by identity and by repr', KeyIdentity, {}, 'KeyIdentity'],
    ['the everyday constructs of Svelte 5', SvelteConstructs, {}, 'SvelteConstructs'],
    ['props given as JavaScript floats', ScalarProps, { amount: 0.42, two_way: 0.42 }, 'ScalarProps'],
    ['two empty groups', GroupHydrate, {}, 'GroupHydrate']
])('the server renders %s', ([, Component, props, name]) => {
    expect(render(Component, { props }).body).toBe(html[name]);
});

// A group whose model holds a selection is checked by the server, as Svelte's
// server checks its own: the page shows it, and a form sent before the script
// runs sends it.
test('the server checks what a group holds, as Svelte does', () => {
    const checked = (Component, props = {}) =>
        [...render(Component, { props }).body.matchAll(/<input data-k="([^"]+)"[^>]*>/g)]
            .filter((one) => /\schecked(?:[\s=/>]|$)/.test(one[0]))
            .map((one) => one[1]);

    const native = checked(GroupServerNative);

    expect(native).toEqual(['b', 'y', 'half']);
    expect(checked(GroupServer)).toEqual(native);

    // And the value written as the shorthand, `{value}`, which the server
    // was handed no value for and left unchecked.
    const shapes = (Component) => checked(Component, { next_value: () => 1 });

    expect(shapes(GroupValueShapesNative)).toEqual(['long', 'short']);
    expect(shapes(GroupValueShapes)).toEqual(shapes(GroupValueShapesNative));
});
