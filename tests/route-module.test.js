// @vitest-environment node
//
// A route module is the one place Svelthon's code runs with no component around
// it: SvelteKit imports the file and calls `load`, `actions.default` or `GET` by
// name, handing each a request event. Node rather than jsdom, because that is
// where they actually run.
//
// Measured gap: `pyExport` and `pyCall` were called by nothing in the suite, and
// `scheduleAsync` was called only by synchronous functions — its coroutine half,
// which is what an `async def load()` needs, had never run.
import { test, expect, describe } from 'vitest';
import * as route from './fixtures/route.py';
import { load, GET, actions, config, boom, streaming } from './fixtures/route.py';

// A RequestEvent as SvelteKit builds one. The conversion is recognised by shape
// — `params`, `url` and `request` together — and anything else is handed over
// untouched, so all three have to be here for the boundary to do its work.
const requestEvent = (search = '?page=2') => ({
    params: { slug: 'pep-703' },
    url: new URL(`https://example.test/peps/pep-703${search}`),
    request: { method: 'GET' },
    route: { id: '/peps/[slug]' }
});

describe('an async load()', () => {
    test('returns a promise, and its value is plain data', async () => {
        const result = load(requestEvent());

        expect(result).toBeInstanceOf(Promise);
        expect(await result).toEqual({
            slug: 'pep-703',
            page: 2,
            method: 'GET',
            keys: ['slug']
        });
    });

    // A JavaScript object has neither, and Python reaches for both.
    test('the event arrives as real dicts — .get() and .keys() answer', async () => {
        expect((await load(requestEvent('')))?.page).toBe(1); // .get() default
    });

    test('the query string stays a string until Python converts it', async () => {
        expect((await load(requestEvent('?page=07'))).page).toBe(7); // int("07")
    });
});

describe('a synchronous handler', () => {
    test('is called by name and returns plain data', () => {
        expect(GET(requestEvent())).toEqual({ method: 'GET', path: 'pep-703' });
    });

    // The error path: a Python exception has neither message nor stack, and
    // would reach SvelteKit as an empty object without this.
    test('an exception carries Python’s own message and where it happened', () => {
        expect(() => boom(requestEvent())).toThrow(/no such page/);
        expect(() => boom(requestEvent())).toThrow(/route\.py/);
    });
});

// Neither a function nor a scalar: it must cross as plain data, with its values
// left alone rather than wrapped as handlers.
describe('an exported mapping of data', () => {
    test('arrives as plain data', () => {
        expect(config).toEqual({ prerender: true, trailing: 'always' });
    });
});

// `actions` is a dict of functions — the one export shape that is neither a
// function nor plain data. Each value has to cross the boundary wrapped, so a
// form action gets the same treatment as a `load()`.
describe('an exported mapping of handlers', () => {
    test('arrives as an object of callables', () => {
        expect(typeof actions.default).toBe('function');
        expect(typeof actions.remove).toBe('function');
    });

    test('each one runs and converts its result', () => {
        expect(actions.default(requestEvent())).toEqual({ saved: 'pep-703' });
        expect(actions.remove(requestEvent())).toEqual({ removed: true });
    });

    test('the same names are on the module', () => {
        expect(Object.keys(route.actions).sort()).toEqual(['default', 'failing', 'refuse', 'remove']);
    });
});

// A `.svelte.py` is a store and carries a default export; a `.py` is a route
// module and carries none. SvelteKit looks up `load` and `actions` by name, so
// the names are the contract — and `__all__` is what declares them.
describe('what a plain module exports', () => {
    test('exactly the names __all__ declares, and no default', () => {
        expect(Object.keys(route).sort()).toEqual([
            'GET',
            'actions',
            'boom',
            'config',
            'load',
            'streaming'
        ]);
    });

    test('a helper left out of __all__ stays private', () => {
        expect(route.save).toBeUndefined();
    });
});

// The paths that only open when something goes right slowly, or wrong: a result
// that is still being computed, and the rejection half of a coroutine.
describe('what a route hands back besides plain data', () => {
    test('a coroutine inside the result becomes a promise', async () => {
        const out = streaming(requestEvent());

        expect(out.now).toBe('pep-703');
        expect(out.later).toBeInstanceOf(Promise);
        expect(await out.later).toEqual({ rows: [1, 2, 3] });
    });

    // The synchronous half of the same story: an action that raises before it
    // ever awaits anything.
    test('an action that raises carries Python’s message', () => {
        expect(() => actions.refuse(requestEvent())).toThrow(/read only/);
        expect(() => actions.refuse(requestEvent())).toThrow(/route\.py/);
    });

    test('a coroutine that raises rejects with Python’s message', async () => {
        await expect(actions.failing(requestEvent())).rejects.toThrow(/gone/);
    });

    test('and the rejection says where it happened', async () => {
        await expect(actions.failing(requestEvent())).rejects.toThrow(/route\.py/);
    });
});
