// **None a Python parent passes its Python child is the absence**, as
// `undefined` a Svelte parent passes is: the child reads its default. And
// `javascript.NULL` is a value, as `null` is, which the default does not
// replace. None was handed as itself, which no Svelte prop reads its default
// for, so a child that wrote None to a prop its Python parent binds read None
// where it reads its default under a JavaScript parent.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PropNoneHost from './fixtures/PropNoneHost.svelte';
import PropNoneHostNative from './fixtures/PropNoneHostNative.svelte';

const shown = (Host) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Host, { target });
    flushSync();

    return Object.fromEntries(
        [...target.querySelectorAll('div')].map((one) => [one.dataset.k, one.innerHTML.replace(/<!--[^>]*-->/g, '')])
    );
};

test.for([
    ['None', 'name', '<p>default</p>'],
    ['None', 'spread', '<p>default</p>'],
    ['javascript.NULL', 'name-null', '<p></p>'],
    ['javascript.NULL', 'spread-null', '<p></p>']
])('%s passed by %s to a Python child reads as Svelte reads its JavaScript form', ([, way, expected]) => {
    const native = shown(PropNoneHostNative)[way];

    expect(native).toBe(expected);
    expect(shown(PropNoneHost)[way]).toBe(native);
});
