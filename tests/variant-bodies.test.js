// **One file written two ways is two components, each running its own Python.**
// A plugin ahead of Svelte's may write a file otherwise for each query it is
// imported under (`tests/variants.js`), and Svelte compiles each to a component
// of its own. The Python of both was filed under the file's name alone, so both
// ran the body compiled last: `alpha, alpha` where Svelte shows `alpha, beta`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import VariantHost from './fixtures/VariantHost.svelte';

const shown = (root, side) => [...root.querySelectorAll(`.${side} output`)].map((one) => one.textContent);

test('two variants of one file each run their own Python, as in Svelte', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(VariantHost, { target });
    flushSync();

    expect(shown(target, 'native')).toEqual(['alpha', 'beta']);
    expect(shown(target, 'python')).toEqual(shown(target, 'native'));
});
