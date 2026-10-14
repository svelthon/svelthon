// **One object two boxes stand for is one choice, even when its `==` says no
// to itself**: identity comes first, as in Python's `in` and `list.remove`, and
// in Svelte's group, which collects into a `Set`. Compared by `==` alone, ticking
// both boxes put the object in twice and showed them unticked, and unticking
// one left it in the selection with both boxes off.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupSameObject from './fixtures/GroupSameObject.svelte';
import GroupSameObjectNative from './fixtures/GroupSameObjectNative.svelte';

test.for([
    ['Python', GroupSameObject],
    ['Svelte', GroupSameObjectNative]
])('%s: the same object ticked in two boxes is held once, and unticked is gone', ([, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });
    flushSync();

    const [a, b] = ['a', 'b'].map((k) => target.querySelector(`[data-k="${k}"]`));
    const tick = (checked) => {
        a.checked = true;
        b.checked = checked;
        b.dispatchEvent(new Event('change', { bubbles: true }));
        flushSync();

        return [...instance.held(), a.checked, b.checked];
    };

    expect(tick(true)).toEqual([1, true, true, true]);
    expect(tick(false)).toEqual([0, false, false, false]);
});
