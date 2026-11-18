// SvelteKit runs a `load()` again when what it read of its event changes, and
// tells what was read by the event's own getters. The snapshot a Python
// `load(event)` is handed read the URL, its query, the params and the route at
// once, so a layout's `load()` ran at every navigation, where the same one in
// JavaScript, reading a cookie, ran once. Each part is read for the framework
// when Python reads its key.
import { test, expect } from 'vitest';
import { runInNewContext } from 'node:vm';
import {
    reads_cookie,
    reads_query,
    reads_absent,
    reads_contains,
    reads_item,
    walks_query,
    counts_query,
    reads_route,
    reads_optional,
    answers,
    answers_later
} from './fixtures/route_reads.py';
import { requestEvent } from './request-event.js';
import { routeLoad } from '../src/lib/bridge.js';

// SvelteKit's URL as `make_trackable` makes it: a key asked of `searchParams` by
// `get`, `getAll` or `has` is noted alone, `search x`; anything else read of the
// query, or the URL's own text, notes the whole URL.
const trackable = (url, note) => {
    const tracked = new URL(url);

    Object.defineProperty(tracked, 'searchParams', {
        value: new Proxy(tracked.searchParams, {
            get(params, key) {
                if (key === 'get' || key === 'getAll' || key === 'has') {
                    return (name, ...rest) => {
                        note(`search ${name}`);
                        return params[key](name, ...rest);
                    };
                }

                note('url');

                const found = Reflect.get(params, key);

                return typeof found === 'function' ? found.bind(params) : found;
            }
        })
    });

    for (const name of ['href', 'pathname', 'search']) {
        Object.defineProperty(tracked, name, {
            get() {
                note('url');
                return url[name];
            }
        });
    }

    return tracked;
};

// An event whose reads SvelteKit would track, each noted once, unless under
// `untrack`.
const tracked = ({ params = { slug: 'pep-8' }, route = { id: '/peps/[slug]' } } = {}) => {
    const one = requestEvent({ url: 'https://example.test/peps/pep-8?x=1&panel=a', params, route });
    const reads = [];
    let tracking = true;
    const note = (what) => {
        if (tracking && !reads.includes(what)) reads.push(what);
    };
    const watched = (target, names) =>
        new Proxy(target, {
            get(object, key) {
                if (names.includes(key)) note(key);
                return Reflect.get(object, key, object);
            }
        });

    const event = {
        ...one,
        url: trackable(one.url, note),
        params: watched(one.params, ['slug']),
        route: watched(one.route, ['id']),
        cookie: 'theme=dark',
        untrack: (read) => {
            tracking = false;
            try {
                return read();
            } finally {
                tracking = true;
            }
        }
    };

    return { event, reads };
};

// A key of the query is noted alone, held or not, as SvelteKit notes
// `searchParams.get`: noted whole, a search's load() ran again when another key
// of the URL changed.
test.for([
    ['the JavaScript event alone', reads_cookie, 'theme=dark', []],
    ['a key of the query', reads_query, '1', ['search x']],
    ['a key the query does not hold', reads_absent, '', ['search q']],
    ['a key of the query, by `in`', reads_contains, true, ['search x']],
    ['a key of the query, by its index', reads_item, '1', ['search x']],
    ['the route and the params', reads_route, ['/peps/[slug]', 'pep-8'], ['id', 'slug']]
])('a load() reading %s is told of that and nothing else', async ([, load, answer, read]) => {
    const { event, reads } = tracked();

    expect(await load(event)).toEqual(answer);
    expect(reads).toEqual(read);
});

// And the whole query when it walks it, its keys or its length.
test.for([
    ['its keys', walks_query, ['panel', 'x']],
    ['its length', counts_query, 2]
])('a load() reading the query’s %s is told of the whole query', async ([, load, answer]) => {
    const { event, reads } = tracked();

    expect(await load(event)).toEqual(answer);
    expect(reads).toContain('url');
});

// SvelteKit notes a param read even when the route holds none of it: an
// optional one absent, `[[slug]]`, was read by no one, and the navigation that
// gave it ran no load(), its page left on the data of the absence.
test('a load() reading an optional param the route does not hold is told of it', async () => {
    const { event, reads } = tracked({ params: {}, route: { id: '/[[slug=word]]' } });

    expect(await reads_optional(event)).toBe('all');
    expect(reads).toEqual(['slug']);
});

// A dict's view is made the plain object SvelteKit's dev server asks of a
// load(), awaited or not; anything else is SvelteKit's to judge. A copy made of
// a thenable, or of another realm's promise, answered `{}`; and one awaited by
// SvelteKit alone answered a dict's view it refused, a JavaScript helper's
// thenable of what a Python callback made.
class Thenable {
    then(resolve) {
        resolve({ answer: 42 });
    }
}

test.for([
    ['a dict', answers, { answer: 42, rows: [1, 2] }],
    ['a dict, awaited', answers_later, { answer: 42, rows: [1, 2] }],
    ["JavaScript's thenable", () => new Thenable(), { answer: 42 }],
    ["another realm's promise", () => runInNewContext('Promise.resolve({ answer: 42 })'), { answer: 42 }],
    ["JavaScript's thenable of a dict", () => ({ then: (resolve) => resolve(answers()) }), { answer: 42, rows: [1, 2] }],
    ["another realm's promise of a dict", () => runInNewContext('(value) => Promise.resolve(value)')(answers()), { answer: 42, rows: [1, 2] }]
])("a route's load() answering %s answers what SvelteKit awaits", async ([, load, answer]) => {
    const data = await routeLoad(load, 'load — route-reads')();

    expect(JSON.parse(JSON.stringify(data))).toEqual(answer);
    expect(Object.getPrototypeOf(data) === Object.prototype || Object.getPrototypeOf(Object.getPrototypeOf(data)) === null).toBe(true);
});
