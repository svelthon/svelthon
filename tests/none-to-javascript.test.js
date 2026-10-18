// `None` reached JavaScript as Brython's own object, which JavaScript calls
// true, at two doors beside the context's: a store's member and what a store's
// function returns, and a `bindable` a Python child sets to `None` for a
// JavaScript parent. A component testing `if (store.user)` after
// `user = None` took the branch for a user. It is `undefined` at every door,
// the engine's pairing, which is what a Svelte child hands the same parent when
// it clears a value; `null` is `javascript.NULL`'s.
import { test, expect } from 'vitest';
import { flushSync } from 'svelte';
import { mount } from './mounted.js';
import store from './fixtures/none_store.svelte.py';
import keys from './fixtures/none_keys.svelte.py';
import NoneBindHost from './fixtures/NoneBindHost.svelte';
import NoneBindChild from './fixtures/NoneBindChild.svelte';
import NoneBindChildNative from './fixtures/NoneBindChildNative.svelte';

test("a store's None is undefined, read and returned", () => {
    expect(store.user).toBe(undefined);
    expect(store.give()).toBe(undefined);
});

// And a key: a dict keyed by None is keyed by `undefined` to JavaScript, as
// `{[undefined]: 1}` is, read through its view and copied by `to_js`, where its
// key was `"null"`. JSON alone spells it `"null"`, as `json.dumps` does.
test('a dict key None is undefined to JavaScript and null in JSON', () => {
    const native = Object.keys({ [undefined]: 1 });

    expect([...keys.viewed()]).toEqual(native);
    expect(Object.keys(keys.copied())).toEqual(native);
    expect(Object.keys(JSON.parse(keys.serialised()))).toEqual(['null']);
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

    // The parent reads `undefined` from both, and each child, once its parent
    // holds `undefined`, reads its default again.
    expect(cleared(NoneBindChildNative)).toEqual(['true:false', 'false']);
    expect(cleared(NoneBindChild)).toEqual(['true:false', 'False']);
});
