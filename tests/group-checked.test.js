// **A box bound to a group and to a boolean of its own compiles, and behaves as
// Svelte's.** The group's `checked`, written for the server, was written beside
// `bind:checked` too, and Svelte refused the component as
// `attribute_duplicate`, whichever order the bindings were in. The same boxes
// in Svelte are the witness, through clicks, a write of the boolean and a
// form's reset.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import GroupChecked from './fixtures/GroupChecked.svelte';
import GroupCheckedNative from './fixtures/GroupCheckedNative.svelte';

const trace = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });
    flushSync();

    const read = () => [JSON.parse(JSON.stringify(instance.model())), [...target.querySelectorAll('input')].map((one) => one.checked)];
    const states = [read()];

    for (const step of ['both', 'other', 'toggle', 'reset', 'both']) {
        if (step === 'reset') target.querySelector('form').reset();
        else if (step === 'toggle') instance.toggle();
        else target.querySelector(`[data-k="${step}"]`).click();
        flushSync();
        states.push(read());
    }

    unmount(instance);

    return states;
};

test.for([
    [false, false],
    [false, true],
    [true, false],
    [true, true]
])('a box bound to a group and to checked, reversed %s, checked first %s, is Svelte’s', ([reverse, initial]) => {
    expect(trace(GroupChecked, { reverse, initial })).toEqual(trace(GroupCheckedNative, { reverse, initial }));
});
