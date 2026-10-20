// Three contracts the template relies on, each checked where it is kept.
import { test, expect, describe, beforeEach } from 'vitest';
import { mount, unmount, flushSync, settled } from './mounted.js';
import AsyncDestroy from './fixtures/AsyncDestroy.svelte';
import Detached from './fixtures/Detached.svelte';
import LambdaWalrus from './fixtures/LambdaWalrus.svelte';
import { events } from './fixtures/lifecycle_log.js';
import { compile } from '../src/lib/compile.js';

beforeEach(() => {
    events.length = 0;
});

const place = (Component, props = {}) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });
    flushSync();
    return { target, instance };
};

// `on_destroy` goes through the wrapper `on_mount` goes through, so an
// `async def` starts, and resumes after its `await`.
test('an async on_destroy runs on unmount', async () => {
    const { instance } = place(AsyncDestroy);
    unmount(instance);
    await settled(() => expect(events).toEqual(['destroy-start', 'destroy-end']));
});

// A child taken out of its list or dict no longer notifies it: what reads the
// container does not re-run when the child changes.
describe('a child taken out of its container', () => {
    test.for(['list', 'dict'])('no longer notifies its former %s', (kind) => {
        const { target } = place(Detached, { kind });
        const press = (key) => {
            target.querySelector(`[data-k="${key}"]`).click();
            flushSync();
        };

        press('detach');
        press('mutate');

        expect(events).toEqual([1, 0]);
        // Control: the child itself still repaints.
        expect(target.querySelector('p').textContent).toBe('1');
    });
});

// A walrus in a lambda binds in the lambda's scope, not in the module's.
describe('a walrus inside a lambda', () => {
    test('leaves the helper of that name to the module', () => {
        const { target } = place(LambdaWalrus);
        expect(target.querySelector('[data-k="lambda"]').textContent).toBe('kept');
        expect(target.querySelector('[data-k="helper"]').textContent).toBe('23 Sept 2026');
    });

    test.for(['new', 'effect'])('does not take the word %s from the component', (name) => {
        expect(() => compile(`f = lambda: (${name} := 1)\n`, 'L', 'l.svelte')).not.toThrow();
    });
});
