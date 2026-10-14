// **Watching a dict asks its keys nothing the call does not ask**: `setdefault`,
// `pop` and `update` call a key's `__hash__` as often on a dict the page reads
// as on one nothing watches. Telling whether the call would change the dict,
// the watch asked the dict for the key first, so a `__hash__` that logs or
// counts its calls saw one more, and one that refused it failed the call.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TrackedDictHash from './fixtures/TrackedDictHash.svelte';

test.for(['setdefault', 'pop', 'update'])('%s on a watched dict hashes its key as often as on another', (how) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(TrackedDictHash, { target });
    flushSync();

    const [alone, watched] = instance.calls(how);

    expect(watched).toBe(alone);
});
