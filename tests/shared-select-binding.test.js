// **Two selects sharing a binding are each bound by what it is**, as Svelte
// binds them: one a spread makes multiple and one it leaves single, in either
// order. The mode was looked up by the binding's text, so the second took the
// first one's: the single one copied the list it chose instead of keeping it,
// or the multiple one missed its None and wrote back a `JavascriptArray`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SharedSelectBinding from './fixtures/SharedSelectBinding.svelte';
import SharedSelectBindingNative from './fixtures/SharedSelectBindingNative.svelte';

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

test.for(['multiple', 'single'])('two selects sharing a binding, the %s one first, are each bound by what it is', (first) => {
    const native = run(SharedSelectBindingNative, first);

    expect(native.initial).toEqual([
        [true, false],
        [true, false]
    ]);
    expect(run(SharedSelectBinding, first)).toEqual(native);
});
