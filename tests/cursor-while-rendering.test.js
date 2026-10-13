// **A cursor that writes itself as the template walks it is refused, as Svelte
// refuses it.** A component's state is deep, as Svelte's `$state` is, and
// `self.index += 1` during `{#each}` is a write to that state while the page
// renders, which Svelte refuses (`state_unsafe_mutation`) for its own cursor
// held in `$state`. Taken into a list by the script first, the cursor is spent
// before rendering and the rows render, in both.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CursorWhileRendering from './fixtures/CursorWhileRendering.svelte';
import CursorWhileRenderingNative from './fixtures/CursorWhileRenderingNative.svelte';

const rendered = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target, props });
    flushSync();

    return [...target.querySelectorAll('[data-k="row"]')].map((one) => one.textContent).join(' ');
};

test.for([
    ['Python', CursorWhileRendering],
    ['Svelte', CursorWhileRenderingNative]
])('%s: a cursor writing itself while the template walks it is refused', ([, Component]) => {
    expect(() => rendered(Component, { listed: false })).toThrow(/state_unsafe_mutation/);
});

test.for([
    ['Python', CursorWhileRendering],
    ['Svelte', CursorWhileRenderingNative]
])('%s: taken into a list before rendering, it renders', ([, Component]) => {
    expect(rendered(Component, { listed: true })).toBe('a b');
});
