// How a test mounts a component, and how it waits for one.
//
// Two things the suite was doing by hand in sixty-six files, each of them a
// small bet.
//
// **Mounting.** 66 files mounted and 5 unmounted, so `$effect` teardowns never
// ran and the shared `fromnow` clock, one `createSubscriber` for the whole
// document, was never released inside a file. It cost nothing visible until
// `custom-element.test.js` left an element in `document.body` and its
// disconnection reached Svelte's `unmount` after jsdom had taken the document
// away: `ReferenceError: document is not defined`, in 4 runs out of 5, as an
// unhandled rejection vitest says "might cause false positive tests".
//
// So `mount` here records what it made and gives it back at the end of the
// test. `unmount` is re-exported and forgets the instance, so a file that ends
// one early is not unmounting it twice.
//
// **Waiting.** Six tests waited on a Brython coroutine with a fixed
// `setTimeout`, from 20 ms to 120 ms, which is a bet on the machine. `settled`
// polls the condition instead, so a slow machine waits longer and a fast one
// stops sooner, and the call site says what it is waiting *for* rather than how
// long it guessed.
import { afterEach, expect, vi } from 'vitest';
import { flushSync, mount as svelteMount, unmount as svelteUnmount } from 'svelte';

const live = [];

afterEach(() => {
    // `outro: false`, because a transition playing into a torn-down document is
    // the failure this exists to prevent.
    while (live.length) svelteUnmount(live.pop(), { outro: false });
});

export function mount(component, options) {
    const instance = svelteMount(component, options);

    live.push(instance);

    return instance;
}

export function unmount(instance, options) {
    const at = live.indexOf(instance);

    if (at !== -1) live.splice(at, 1);

    return svelteUnmount(instance, options);
}

// `check` throws until the thing has happened, which is what any `expect` does,
// so a call site reads as the assertion it is waiting on.
export const settled = (check) =>
    vi.waitFor(() => {
        flushSync();
        check();
    });

// `waiting` is what every async fixture renders while its coroutine is in
// flight, so this is the one condition they share.
export const rendered = (read, ...keys) =>
    settled(() => {
        for (const key of keys) expect(read(key)).not.toBe('waiting');
    });

export { flushSync };
