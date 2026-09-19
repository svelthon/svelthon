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
import {
    load,
    GET,
    actions,
    config,
    boom,
    streaming,
    shared,
    separate,
    given,
    given_second
} from './fixtures/route.py';
import { requestEvent as event, prerenderingEvent, foreignRealmEvent } from './request-event.js';

// A RequestEvent as SvelteKit builds one, from the one place that says what
// that is. The conversion is recognised by what the event's members *are* — a
// URL, a Request, an event `fetch` — and anything else is handed over untouched.
const requestEvent = (search = '?page=2') =>
    event({
        url: `https://example.test/peps/pep-703${search}`,
        params: { slug: 'pep-703' },
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
            'given',
            'given_second',
            'load',
            'runs_count',
            'separate',
            'shared',
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

    // The same coroutine under two keys. The conversion recognised a coroutine
    // and scheduled it *before* consulting its memo, so a second reference
    // started it again: two promises, and the Python body run twice. A result
    // that streams a shared computation did the work once per key.
    //
    // The count is the assertion. Both shapes — `a === b` and `await a` giving
    // 42 — were true while the body ran twice, which is what
    // `tests/route-module.test.js` could not see before.
    test('a coroutine held under two keys runs once', async () => {
        const before = route.runs_count(requestEvent());
        const out = shared(requestEvent());

        await Promise.all([out.a, out.b, out.nested.c]);

        expect(route.runs_count(requestEvent()) - before).toBe(1);
        expect(await out.a).toEqual({ answer: 42 });
    });

    test('and is one promise, at every depth it appears', async () => {
        const out = shared(requestEvent());

        expect(out.a).toBe(out.b);
        expect(out.nested.c).toBe(out.a);

        await out.a;
    });

    // The witness: distinct coroutines are distinct work.
    test('while two coroutines are two runs', async () => {
        const before = route.runs_count(requestEvent());
        const out = separate(requestEvent());

        expect(out.a).not.toBe(out.b);

        await Promise.all([out.a, out.b]);

        expect(route.runs_count(requestEvent()) - before).toBe(2);
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

// Which objects are a request event, and which are only shaped like one.
//
// The recognition used to be three truthy names — `params`, `url`, `request` —
// and three names are not rare. An outside reading handed the boundary an
// ordinary business object carrying them: it was converted, its own fields
// disappeared from the level Python reads, `value.payload` was gone, and nothing
// raised. Data went missing and the page was merely wrong.
//
// What it asks now is what the members *are*, and the rows below take the real
// event apart one member at a time. Each near-miss is a genuine event with one
// thing made ordinary, so no row can pass for the wrong reason.
describe('what crosses as a request event', () => {
    const business = { payload: 42 };

    test('the event itself arrives as real dicts', () => {
        expect(given(event())).toEqual({
            kind: 'dict',
            keys: ['js', 'method', 'params', 'query', 'route', 'url']
        });
    });

    test.for([
        // What is wrong with it, and the object.
        ['nothing but the names', { ...business, params: {}, url: 'https://e.test/', request: { method: 'GET' } }],
        ['a url that is a string', { ...event(), ...business, url: 'https://e.test/' }],
        // The fourth reading's object, and the row that says why a URL is asked
        // to be a value of a class: everything else about this one is genuine —
        // a real Request, an event `fetch`, business params — and its `url` is
        // two strings in a bag. It passed, and its `payload` disappeared.
        [
            'a url built out of Object',
            {
                ...event(),
                ...business,
                url: {
                    pathname: '/api',
                    protocol: 'https:',
                    href: 'https://e.test/api?q=one',
                    searchParams: new URL('https://e.test/api?q=one').searchParams
                }
            }
        ],
        ['a request that only names a method', { ...event(), ...business, request: { method: 'GET' } }],
        ['no fetch of its own', { ...event(), ...business, fetch: undefined }]
    ])('ordinary data with %s crosses untouched', ([, value]) => {
        expect(given(value)).toEqual({ kind: 'JSObject', payload: 42 });
    });

    // Prerendering, where the URL is a proxy that throws from `searchParams`.
    // The recognition must not be what touches it: reading it in the guard threw
    // before the fallback that exists for exactly this could run, and a page
    // that builds fine in dev failed at build time.
    test('and an event whose query cannot be read is still an event', () => {
        expect(given(prerenderingEvent())).toEqual({
            kind: 'dict',
            keys: ['js', 'method', 'params', 'query', 'route', 'url']
        });
    });

    // And an object that *throws* from a member the recognition reads. A lazy or
    // guarded property is ordinary in a library object, and the probe used to
    // run it: the exception came out of `pyArg`, before the Python function that
    // only wanted `payload` ever ran. Asking what something is must not be able
    // to fail.
    test('and ordinary data whose fetch throws when read crosses untouched', () => {
        const value = { payload: 42 };

        Object.defineProperty(value, 'fetch', {
            get() {
                throw new Error('not yours to read');
            },
            enumerable: false,
            configurable: true
        });

        expect(given(value)).toEqual({ kind: 'JSObject', payload: 42 });
    });

    // And a URL that refuses the member the recognition itself reads. No version
    // of SvelteKit guards `pathname` today, and the rule held here is what the
    // boundary does when one does: the throw must not **escape** — that was the
    // prerender defect — and it answers no.
    //
    // It answered *yes* for a day, on the reasoning that a guarded member is
    // still a URL. That widens the recognition by an accident rather than by a
    // measurement, and it trades the mild failure for the bad one: refusing a
    // genuine event is loud, and admitting a business object is silent.
    test('and an event whose URL refuses the member the guard reads is refused', () => {
        expect(given(prerenderingEvent({ refuses: ['pathname'] }))).toMatchObject({
            kind: 'JSObject'
        });
    });

    // A URL built in another JavaScript context, which is what an adapter, a
    // worker or an iframe hands over: it behaves like a URL and is not *our*
    // URL. Asking `instanceof` here let a genuine event cross as ordinary data,
    // and the handler raised on `event['method']` — a recognition at a boundary
    // that takes values from elsewhere cannot be an identity test.
    test('and an event whose URL comes from another context is still an event', () => {
        expect(given(foreignRealmEvent())).toEqual({
            kind: 'dict',
            keys: ['js', 'method', 'params', 'query', 'route', 'url']
        });
    });

    // Every argument takes this road, not only the first one a route is handed.
    test('and the same holds of an argument that is not the first', () => {
        expect(given_second(event(), { ...event(), ...business, url: 'https://e.test/' })).toEqual({
            kind: 'JSObject',
            payload: 42
        });
    });
});

// Both awkward URLs, run end to end through a real handler rather than asserted
// about at the boundary.
describe('a load() whose URL is not the ordinary one', () => {
    test('reads its query by parsing the URL again', async () => {
        const out = await load(
            prerenderingEvent({
                url: 'https://example.test/peps/pep-703?page=7',
                params: { slug: 'pep-703' },
                route: { id: '/peps/[slug]' }
            })
        );

        expect(out).toEqual({ slug: 'pep-703', page: 7, method: 'GET', keys: ['slug'] });
    });

    test('and reads it normally when the URL comes from another context', async () => {
        const out = await load(
            foreignRealmEvent({
                url: 'https://example.test/peps/pep-703?page=7',
                params: { slug: 'pep-703' },
                route: { id: '/peps/[slug]' }
            })
        );

        expect(out).toEqual({ slug: 'pep-703', page: 7, method: 'GET', keys: ['slug'] });
    });
});
