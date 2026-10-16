// **None a Python parent passes is None to its Python child**, as `null` a
// Svelte parent passes is `null` to its child: a value, which the default does
// not replace. Called from JavaScript, the Python expression gave `undefined`
// for None, and the child read its default, by name and in a spread alike.
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

test.for(['name', 'spread'])('None passed by %s to a Python child is None and not its default, as null in Svelte', (way) => {
    const native = shown(PropNoneHostNative)[way];

    expect(shown(PropNoneHost)[way]).toBe(native);
    expect(native).toBe('<p></p>');
});
