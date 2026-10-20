import { test, expect, describe } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import Lifecycle from './fixtures/Lifecycle.svelte';
import ConditionalLifecycleHost from './fixtures/ConditionalLifecycleHost.svelte';
import BranchedLifecycle from './fixtures/BranchedLifecycle.svelte';
import UnboundLifecycle from './fixtures/UnboundLifecycle.svelte';
import AssignedLifecycle from './fixtures/AssignedLifecycle.svelte';
import StarHooks from './fixtures/StarHooks.svelte';
import { records, reset } from './fixtures/star_records.js';

// on_mount / on_destroy by naming convention, backed by a single $effect: the
// body runs once the DOM is in place, the cleanup when the component goes away.
describe('lifecycle', () => {
    test('on_mount runs after mounting', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Lifecycle, { target });
        flushSync();

        expect(target.querySelector('p[data-k="started"]').textContent).toBe('yes');
    });

    test('on_destroy runs on unmount, with the final state', () => {
        const seen = [];
        const target = document.body.appendChild(document.createElement('div'));
        const app = mount(Lifecycle, { target, props: { notify: (msg) => seen.push(msg) } });
        flushSync();

        target.querySelector('button[data-k="tick"]').click();
        target.querySelector('button[data-k="tick"]').click();
        flushSync();
        expect(target.querySelector('p[data-k="ticks"]').textContent).toBe('2');

        expect(seen).toEqual([]);
        unmount(app);
        flushSync();

        expect(seen).toEqual(['destroyed after 2 tick(s)']);
    });

    test('on_mount does not replay when state changes', () => {
        // The real risk: the $effect reads the functions' signals, and would
        // replay on every write if it tracked one that changes.
        const target = document.body.appendChild(document.createElement('div'));
        mount(Lifecycle, { target });
        flushSync();

        target.querySelector('button[data-k="tick"]').click();
        target.querySelector('button[data-k="tick"]').click();
        flushSync();

        expect(target.querySelector('p[data-k="mounts"]').textContent).toBe('1');
    });
});

// A hook is what its name holds once the script has run, not the `def` the
// compiler saw: a `def` under an `if` not taken leaves the name unbound, and an
// unbound hook is not called, as Svelte's `onMount` in a branch not taken is
// never registered. Any other value is called and reports its own error.
describe('a hook is the value its name holds', () => {
    // Mounts, flushes, and hands back the instance, its target and the log.
    const mounted = (Component, props) => {
        const log = [];
        const target = document.body.appendChild(document.createElement('div'));
        const app = mount(Component, { target, props: { ...props, log: (line) => log.push(line) } });

        flushSync();

        return { app, target, log };
    };

    test.for([
        [false, [], []],
        [true, ['mount first'], ['mount first', 'cleanup', 'destroy']]
    ])('defined under `if %s`: runs once, its cleanup before on_destroy', async ([enabled, alive, gone]) => {
        const { app, target, log } = mounted(ConditionalLifecycleHost, { enabled });

        app.relabel('second');
        flushSync();

        expect(target.querySelector('[data-k="label"]').textContent).toBe('second');
        expect(log).toEqual(alive);

        // Awaited: what a teardown throws rejects the promise `unmount` hands back.
        await unmount(app);

        expect(log).toEqual(gone);
    });

    test.for([
        [true, ['mount short'], ['mount short']],
        [false, ['mount long'], ['mount long', 'destroy long']]
    ])('defined in an `if`/`else` (short=%s): the branch taken is the hook', async ([short, alive, gone]) => {
        const { app, log } = mounted(BranchedLifecycle, { short });

        expect(log).toEqual(alive);

        await unmount(app);

        expect(log).toEqual(gone);
    });

    test.for([
        ['kept', ['mount', 'destroy']],
        ['deleted', []]
    ])('`%s`: a deleted hook is unbound, and is not called', async ([mode, gone]) => {
        const { app, log } = mounted(UnboundLifecycle, { mode });

        await unmount(app);

        expect(log).toEqual(gone);
    });

    // Bound by `=`, the hook was never called: only a `def` was read as one.
    test('bound by `=`: runs once, its cleanup before on_destroy', async () => {
        const { app, log } = mounted(AssignedLifecycle);

        expect(log).toEqual(['mount']);

        await unmount(app);

        expect(log).toEqual(['mount', 'cleanup', 'destroy']);
    });

    // Brought by `from m import *`, which binds names no statement of the
    // component lists: the hooks were imported, and never called.
    test('brought by `import *`: runs once, its cleanup before on_destroy', async () => {
        reset();

        const { app } = mounted(StarHooks);

        expect(records).toEqual(['mount']);

        await unmount(app);

        expect(records).toEqual(['mount', 'cleanup', 'destroy']);
    });

    test('a hook bound to None is called, and says so', () => {
        expect(() => mounted(UnboundLifecycle, { mode: 'none' })).toThrow(TypeError);
    });
});
