// @vitest-environment node
//
// The server half of `prop-float-default.test.js`: a server destructures the
// props before init() wrote the defaults, and still renders each float.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import PropFloatDefault from './fixtures/PropFloatDefault.svelte';
import PropFloatDefaultHost from './fixtures/PropFloatDefaultHost.svelte';

const shown = (Component, props) => render(Component, { props }).body.replace(/<!--[^>]*-->/g, '');

test.for([
    ['with no parent', PropFloatDefault, {}, 'float 1.0|float 2.0'],
    ['passed nothing', PropFloatDefaultHost, {}, 'float 1.0|float 2.0'],
    ['passed ints', PropFloatDefaultHost, { scale: 1, ratio: 3 }, 'int 1|int 3']
])('a float default renders on a server %s', ([, Component, props, expected]) => {
    expect(shown(Component, props)).toBe(`<p>${expected}</p>`);
});
