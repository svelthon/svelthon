import { test, expect, describe } from 'vitest';
import { mount, flushSync, settled } from './mounted.js';
import Async from './fixtures/Async.svelte';
import AsyncError from './fixtures/AsyncError.svelte';
import AsyncExports from './fixtures/AsyncExports.svelte';
import { schedule } from '../src/lib/runtime.js';
import './fixtures/route.py'; // compiled and registered, for the coroutine below
import {
    from_foreign,
    from_local,
    from_custom,
    from_callable,
    from_function,
    from_rejected,
    from_getter,
    from_trapped,
    from_promise_getter,
    from_function_getter,
    from_raising,
    callbacks,
    then_calls
} from './fixtures/promises.py';
import { getter, trapped, promiseGetter, functionGetter, raising, thenReads } from './fixtures/foreign_promise.js';

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

// The rethrow above is for a handler nobody waits for. When somebody does wait,
// the failure reaches them and reporting it again would make a caught error
// escape anyway. `schedule` tells the two apart by watching its own `.then`,
// so it has to be a promise that calls `.then` when it is awaited.
//
// A `.py` module is where a test can hold a Python coroutine of its own; what
// is under test is the component boundary that wraps one.
describe('a coroutine whose caller waits for it', () => {
    const failing = () => {
        const $B = globalThis.__BRYTHON__;

        return $B.$call($B.$getattr($B.imported['route'], 'failing'), null);
    };

    test('reaches the caller and is not reported a second time', async () => {
        const original = globalThis.setTimeout;
        const pending = [];
        globalThis.setTimeout = (fn, ...rest) =>
            typeof fn === 'function' && rest.length === 0 ? pending.push(fn) : original(fn, ...rest);

        let caught;
        try {
            await schedule(failing(), 'waited');
        } catch (error) {
            caught = error;
        } finally {
            globalThis.setTimeout = original;
        }

        expect(caught.message).toContain('KeyError');
        expect(pending).toHaveLength(1);
        expect(pending[0]).not.toThrow();
    });
});

// What an exported function hands back *behind* something awaitable.
//
// A returned value crosses under the export's rule — a callable becomes a
// JavaScript function, a dict becomes an object — and a promise's resolved value
// is that value one step later. The site that decided whether to wait asked
// `result instanceof Promise`, which asks about **our** Promise constructor: a
// promise built in another JavaScript context answers false, so the same
// function handing back the same dict answered `{answer: 42}` or a raw Brython
// dict, symbols and all, according to which context made the promise.
//
// It is the realm mistake of `URL` and `Date` at a third site, and it was
// measured a day before and dismissed — on the reasoning that a foreign promise
// resolves to a JavaScript value with nothing left to convert. True of a promise
// a library makes for itself; false the moment it is handed a Python value to
// resolve with, which is what a `__js__` helper does. The measurement was right
// and what I inferred from it was not.
describe('a value handed back behind a promise', () => {
    const expected = { answer: 42, rows: [1, 2] };

    test.for([
        ['built here', () => from_local()],
        // The row that was wrong, and the one that says what the question is.
        ['built in another context', () => from_foreign()],
        // And a bare thenable, which `await` accepts and no constructor claims:
        // asking the way `await` asks is what covers all three at once.
        ['a plain object with a then', () => from_custom()],
        // And the shape a `typeof === 'object'` predicate cannot see: a function
        // carrying a `then`. `await` and `Promise.resolve` call it like anyone
        // else's, so the row belongs beside the others rather than in a case of
        // its own — the matrix was three rows and the missing one was a *type*.
        ['a function with a then', () => from_callable()],
        // And a `then` given by a getter or a proxy's trap, which `await` reads
        // as it reads a method.
        ['an object whose then is a getter', () => from_getter()],
        ['a proxy whose trap gives a then', () => from_trapped()],
        ['a promise whose then is a getter', () => from_promise_getter()],
        ['a function whose then is a getter', () => from_function_getter()]
    ])('%s crosses as data', async ([, run]) => {
        await expect(run()).resolves.toEqual(expected);
    });

    // And its `then` is read as many times as `await` reads it: once for a
    // getter or a trap, never for a promise's own.
    test.for([
        ['an object whose then is a getter', getter, from_getter],
        ['a proxy whose trap gives a then', trapped, from_trapped],
        ['a promise whose then is a getter', promiseGetter, from_promise_getter],
        ['a function whose then is a getter', functionGetter, from_function_getter]
    ])('%s has its then read as await reads it', async ([, native, crossing]) => {
        let before = thenReads();
        await native();
        const awaited = thenReads() - before;

        before = thenReads();
        await crossing();
        expect(thenReads() - before).toBe(awaited);
    });

    test('and a rejection passes through untouched', async () => {
        await expect(from_rejected()).rejects.toThrow(/gone/);
    });

    // A Python exception that rejects what a `def` handed back, an
    // `aio.Future` failed by Python, is described as the same exception is
    // when raised: it reached the caller without a message or a stack.
    test('and a rejection with a Python exception reads as one raised', async () => {
        const { failed_future, awaited_future } = await import('./fixtures/failed_future.py');
        const caught = async (run) => {
            try {
                await run();
            } catch (error) {
                return error.message;
            }
        };

        expect(await caught(failed_future)).toMatch(/^ValueError: delayed failure \(/);
        expect(await caught(awaited_future)).toMatch(/^ValueError: delayed failure \(/);
    });

    // A `then` getter that raises rejects, as `await` rejects.
    test('and a then getter that raises rejects as await rejects', async () => {
        await expect((async () => await raising())()).rejects.toThrow(/no then/);
        await expect(from_raising()).rejects.toThrow(/no then/);
    });

    // A Python dict whose key is `then` is data: no promise, no call.
    test('while a dict with a then key comes back as data, its callback uncalled', async () => {
        const value = callbacks();
        await Promise.resolve();

        expect(value).not.toBeInstanceOf(Promise);
        expect(value.answer).toBe(7);
        expect(then_calls()).toBe(0);
    });

    // The control the row above needs: an ordinary function is not awaitable and
    // has to come back as something a caller can call, not as what it returns.
    test('while an ordinary function comes back callable', () => {
        expect(from_function()()).toBe('called');
    });
});

// A component's export hands the framework JavaScript numbers, a transition's
// `duration` above all, and an `async def` export hands them over once
// resolved: a Brython float is an object.
describe("what a component's async export resolves to", () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        return { target, instance: mount(AsyncExports, { target }) };
    };

    test.for([
        ['a value', 'value', (x) => x],
        ['a config', 'config', (x) => x.duration]
    ])('%s is converted as the synchronous export converts it', async ([, kind, scalar]) => {
        const { instance } = setup();
        expect(scalar(instance[`sync_${kind}`]())).toBe(0.5);
        expect(scalar(await instance[`async_${kind}`]())).toBe(0.5);
    });

    test('a failure still rejects with the Python error', async () => {
        await expect(setup().instance.async_failing()).rejects.toThrow(/boom/);
    });

    test('and an awaited float in the markup prints as Python prints it', async () => {
        const { target } = setup();
        await settled(() => expect(target.querySelector('[data-k="await"]')?.textContent).toBe('0.5'));
    });
});
