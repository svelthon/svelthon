// **Each render of a snippet's select is bound by what it is**, as Svelte binds
// it: one render a spread makes multiple and one it leaves single, in either
// order. The mode was looked up by the select's place in the markup, which the
// two renders share, so the second took the first one's: the single one copied
// the list it chose, or the multiple one missed its None and wrote back a
// `JavascriptArray`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SnippetSelects from './fixtures/SnippetSelects.svelte';
import SnippetSelectsNative from './fixtures/SnippetSelectsNative.svelte';

const run = (Component, first) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { first } });
    flushSync();

    const select = (k) => target.querySelector(`[data-k="${k}"]`);
    const shown = () => ['multiple', 'single'].map((k) => [...select(k).options].map((one) => one.selected));
    const choose = (k, at) => {
        [...select(k).options].forEach((one, index) => (one.selected = index === at));
        select(k).dispatchEvent(new Event('change', { bubbles: true }));
        flushSync();

        return [shown(), instance.model()];
    };

    return { initial: shown(), single: choose('single', 0), multiple: choose('multiple', 1) };
};

test.for(['multiple', 'single'])('a snippet rendered twice, the %s select first, binds each by what it is', (first) => {
    const native = run(SnippetSelectsNative, first);

    expect(native.initial).toEqual([
        [true, false],
        [true, false]
    ]);
    expect(run(SnippetSelects, first)).toEqual(native);
});
