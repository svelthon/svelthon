// What a Python component hands Svelte behaves as Svelte's own would: an async
// effect runs, and `on_mount` hands back its cleanup.
import { test, expect, beforeEach } from 'vitest';
import { mount, unmount, flushSync, settled } from './mounted.js';
import AsyncLifecycle from './fixtures/AsyncLifecycle.svelte';
import { events } from './fixtures/lifecycle_log.js';

beforeEach(() => {
    events.length = 0;
});

// An `async def` under `@effect` is started, as `$effect(async () => …)` is;
// what it reads before its first `await` is what it follows.
test('an async effect runs, and on_mount hands back its cleanup', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(AsyncLifecycle, { target });
    flushSync();

    await settled(() => expect(events).toEqual(['effect ran 0', 'mounted', 'effect finished']));

    unmount(instance);

    expect(events.slice(3)).toEqual(['mount cleanup', 'destroyed']);
});
