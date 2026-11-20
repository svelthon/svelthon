// What a Python component hands Svelte behaves as Svelte's own would: an async
// effect runs, and `on_mount` hands back its cleanup.
import { test, expect, beforeEach } from 'vitest';
import { mount, unmount, flushSync, settled } from './mounted.js';
import AsyncLifecycle from './fixtures/AsyncLifecycle.svelte';
import HooksImported from './fixtures/HooksImported.svelte';
import HooksMixed from './fixtures/HooksMixed.svelte';
import HooksDerived from './fixtures/HooksDerived.svelte';
import HooksRoot from './fixtures/HooksRoot.svelte';
import HooksProps from './fixtures/HooksProps.svelte';
import HooksModule from './fixtures/HooksModule.svelte';
import HooksNative from './fixtures/HooksNative.svelte';
import HooksKeyed from './fixtures/HooksKeyed.svelte';
import HooksComputedKey from './fixtures/HooksComputedKey.svelte';
import { on_mount, on_destroy } from './fixtures/lifecycle_hooks.js';
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

// A hook is what the name holds once the script has run, however it was bound:
// the compiler asked a `def` and a value bound by `=` alone, so a hook imported
// from JavaScript, by the script or by the `<script module>`, or handed as a
// prop was never called, `on_destroy` of the mixed one neither. Each as the
// Svelte component registering the same functions with `onMount` and
// `onDestroy` does.
test.for([
    ['imported', HooksImported, {}],
    ['one bound by =, one imported', HooksMixed, {}],
    ['handed as props', HooksProps, { on_mount, on_destroy }],
    ['imported by the module script', HooksModule, {}],
    // A derived too, `on_mount => …` and `@derived`: the compiler did not ask
    // it, and neither hook ran, the cleanup included.
    ['held by a derived', HooksDerived, {}],
    // Bound at its key of `globals()`, which no statement names, or at a key
    // computed: neither hook ran, and nothing said so.
    ['bound at its key of globals()', HooksKeyed, {}],
    ['bound at a key computed', HooksComputedKey, {}]
])('a hook %s runs as Svelte’s does', ([, Component, props]) => {
    const run = (Component, props) => {
        events.length = 0;

        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(Component, { target, props });
        flushSync();

        const mounted = [...events];

        unmount(instance);

        return [mounted, [...events]];
    };

    expect(run(HooksNative, {})).toEqual([['mount'], ['mount', 'cleanup', 'destroy']]);
    expect(run(Component, props)).toEqual(run(HooksNative, {}));
});

// Any binding of the name, a root among them: `@effect.root` binds its name to
// the destructor, which the component's end calls, as Svelte's
// `onDestroy($effect.root(…))` does. The root outlived the component.
test('a root named on_destroy is stopped when the component goes', () => {
    events.length = 0;

    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(HooksRoot, { target });
    flushSync();

    expect(events).toEqual(['start']);

    unmount(instance);

    expect(events).toEqual(['start', 'stop']);
});

// And a prop a parent does not pass is no hook: nothing runs, and nothing fails.
test('a hook prop left unpassed runs nothing', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(HooksProps, { target });
    flushSync();
    unmount(instance);

    expect(events).toEqual([]);
});
