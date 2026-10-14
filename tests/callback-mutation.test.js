// **What the author's code changes while a call runs repaints the page**, as a
// `SvelteSet` or a `SvelteMap` changed the same way does. A member's `__eq__`
// may swap two members while `add(1)` finds 1 there already, and a key's
// `__hash__` may update another value while `setdefault` finds its key: the call
// changes nothing of its own. The watch kept quiet what ran inside the call and
// read the call's own effect off a size or a count of keys, so the model held
// the change and the page did not.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CallbackMutation from './fixtures/CallbackMutation.svelte';
import CallbackMutationNative from './fixtures/CallbackMutationNative.svelte';

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        [
            ['set add', '3,key|old'],
            ['set discard', '3,key|old'],
            ['set remove', '3,key|old'],
            ['dict setdefault', '2,key|new'],
            ['dict pop', '2,key|new']
        ].map(([kind, after]) => [language, kind, after])
    )
)('%s: %s, changing the container through the author’s code, shows %s', ([language, kind, after]) => {
    const Component = language === 'Python' ? CallbackMutation : CallbackMutationNative;
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { kind } });
    flushSync();

    expect(target.querySelector('output').textContent).toBe('2,key|old');

    instance.change();
    flushSync();

    expect(target.querySelector('output').textContent).toBe(after);
});
