// `None` reached JavaScript as Brython's own object, which JavaScript calls
// true, at two doors beside the context's: a store's member and what a store's
// function returns, and a `bindable` a Python child sets to `None` for a
// JavaScript parent. A component testing `if (store.user)` after
// `user = None` took the branch for a user. It is `null` at every door, which
// is what a Svelte child hands the same parent.
import { test, expect } from 'vitest';
import { flushSync } from 'svelte';
import { mount } from './mounted.js';
import store from './fixtures/none_store.svelte.py';
import NoneBindHost from './fixtures/NoneBindHost.svelte';
import NoneBindChild from './fixtures/NoneBindChild.svelte';
import NoneBindChildNative from './fixtures/NoneBindChildNative.svelte';

test("a store's None is null, read and returned", () => {
    expect(store.user).toBe(null);
    expect(store.give()).toBe(null);
});

test('a bindable a Python child sets to None reaches a JavaScript parent as a Svelte child’s does', () => {
    const cleared = (Child) => {
        const target = document.body.appendChild(document.createElement('div'));
        const host = mount(NoneBindHost, { target, props: { Child } });

        flushSync();
        host.clear();
        flushSync();

        return [target.querySelector('[data-k="parent"]').textContent, target.querySelector('[data-k="child"]').textContent];
    };

    expect(cleared(NoneBindChildNative)).toEqual(['true:false', 'true']);
    expect(cleared(NoneBindChild)).toEqual(['true:false', 'True']);
});
