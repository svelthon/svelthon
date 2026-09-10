import { test, expect, describe } from 'vitest';
import { mount, flushSync, settled } from './mounted.js';
import Async from './fixtures/Async.svelte';
import AsyncError from './fixtures/AsyncError.svelte';

// Calling an `async def` from JavaScript returns a coroutine nobody runs — the
// handler would appear to do nothing at all. Brython has its own event loop, so
// the wrapper hands it over. (`async def` is also a distinct AST node, and
// missing it left async handlers undefined in the first place.)
describe('async def', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Async, { target });
        flushSync();
        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            },
            // The condition rather than a delay: a slow machine waits longer
            // and a fast one stops sooner.
            settle: (check) => settled(check)
        };
    };

    test('an async handler runs', async () => {
        const { read, click, settle } = setup();

        expect(read('plain')).toBe('no');
        click('go-plain');
        await settle(() => expect(read('plain')).toBe('yes'));
    });

    test('await yields, then resumes', async () => {
        const { read, click, settle } = setup();

        click('go-awaited');
        flushSync();
        expect(read('awaited')).toBe('no'); // suspended on await

        await settle(() => expect(read('awaited')).toBe('yes'));
        expect(read('order')).toBe("['before', 'after']");
    });
});

// Brython runs coroutines through a loop of its own, whose default error
// handler merely logs: an exception raised inside a coroutine therefore reached
// nothing at all. We re-raise it from a timer, which makes it a genuine uncaught
// error — visible in devtools and in the overlay.
describe('error inside a coroutine', () => {
    test('it surfaces, named and located', async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(AsyncError, { target });
        flushSync();

        // jsdom does not route what a timer throws to window.error: we
        // intercept the timer to observe the real path.
        const original = globalThis.setTimeout;
        const pending = [];
        globalThis.setTimeout = (fn, ...rest) =>
            typeof fn === 'function' && rest.length === 0 ? pending.push(fn) : original(fn, ...rest);

        try {
            target.querySelector('button[data-k="boom"]').click();
            await new Promise((resolve) => original(resolve, 80));
        } finally {
            globalThis.setTimeout = original;
        }

        expect(pending).toHaveLength(1);
        expect(pending[0]).toThrow(
            /ValueError: broken inside the coroutine \(boom\(\) — tests\/fixtures\/AsyncError\.svelte/
        );
    });

    test('a coroutine that completes triggers nothing', async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(AsyncError, { target });
        flushSync();

        target.querySelector('button[data-k="fine"]').click();

        await settled(() =>
            expect(target.querySelector('p[data-k="state"]').textContent).toBe('ok')
        );
    });
});
