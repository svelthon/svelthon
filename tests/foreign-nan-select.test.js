// **A multiple select bound to a JavaScript array holding a NaN mounts, and shows
// each option the array holds**, the NaN's among them, as in Svelte. The value
// a binding compares was asked of the NaN itself, a JavaScript scalar, and a NaN
// is no key of a WeakMap: `Invalid value used as weak map key`, at the mount and
// on a server. Then the option read off the array, a Python float, was handed
// over as another value than the NaN the array holds, and showed unselected.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ForeignNanSelect from './fixtures/ForeignNanSelect.svelte';
import ForeignNanSelectNative from './fixtures/ForeignNanSelectNative.svelte';

test.for([
    ['Python', ForeignNanSelect],
    ['Svelte', ForeignNanSelectNative]
])('%s: a multiple select over a JavaScript array holding a NaN shows each value selected', ([, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();

    expect([...target.querySelectorAll('option')].map((one) => one.selected)).toEqual([true, true]);
});
