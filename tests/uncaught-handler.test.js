import { test, expect, describe, vi } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Raiser from './fixtures/Raiser.svelte';

// What leaves a handler when nothing catches it.
//
// `pyError` fills a message and a stack into the Brython exception and hands
// back the same object, deliberately: an `except ValueError` further up has to
// see its own value. A DOM handler is the other end of that — past it there is
// no Python left, only whatever the host does with an uncaught error.
//
// What the host does is walk it, and a Brython exception carries `ob_type`, so
// from there its class and `__mro__`, which contains itself. Measured on this
// five-line component: `Aborted (core dumped)`, `OOMErrorHandler`. Not a failing
// test naming the file — the worker dying, and `npm test` ending on a V8 abort.
//
// The line this holds is the value, not the crash: a test that bets the worker
// is a test that takes the run down when it regresses.
describe('an uncaught exception in a handler', () => {
    const clicking = () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(Raiser, { target });
        flushSync();

        const seen = [];
        const heard = (event) => {
            seen.push(event.error);
            event.preventDefault();
        };

        window.addEventListener('error', heard);
        target.querySelector('button[data-k="boom"]').click();
        window.removeEventListener('error', heard);

        return seen;
    };

    test('reaches the host as an ordinary Error', () => {
        const [error] = clicking();

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(/ValueError: BOOM/);
        expect(error.message).toMatch(/Raiser\.svelte:5/);
    });

    // The half that was tried and did not work: keeping the Python object on the
    // Error under a non-enumerable property. A serialiser reaches an own
    // property whether it is enumerable or not, and the abort survived.
    test('carrying nothing of the Python object', () => {
        const [error] = clicking();

        expect(Object.getOwnPropertyNames(error).sort()).toEqual(['message', 'stack']);
        expect(error.ob_type).toBeUndefined();
    });

    // And from an `async def`, whose failure nobody awaited: the timer that
    // throws it to the host throws the same ordinary Error.
    test('from an async def, reaches the host as an ordinary Error too', async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Raiser, { target });
        flushSync();

        const original = globalThis.setTimeout;
        const pending = [];
        globalThis.setTimeout = (fn, ...rest) =>
            typeof fn === 'function' && rest.length === 0 ? pending.push(fn) : original(fn, ...rest);

        // Svelte schedules a timer of its own after a click it delegated, to
        // let the event it propagated go: ours is the one that throws.
        const thrown = [];

        try {
            target.querySelector('button[data-k="later"]').click();
            await vi.waitFor(() => {
                for (const fn of pending.splice(0)) {
                    try {
                        fn();
                    } catch (caught) {
                        thrown.push(caught);
                    }
                }
                expect(thrown).not.toHaveLength(0);
            });
        } finally {
            globalThis.setTimeout = original;
        }

        const [error] = thrown;

        expect(thrown).toHaveLength(1);
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(/ValueError: LATER/);
        expect(error.ob_type).toBeUndefined();
    });
});
