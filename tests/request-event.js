// A SvelteKit request event, as the framework builds one.
//
// Two test files were each imitating it, and both imitations were looser than
// the real thing: `request: { method: 'GET' }` in place of a `Request`, and no
// `fetch` at all. That is how the boundary came to recognise an event by three
// truthy names — a test that hands over less than the framework does cannot
// notice that the recognition asks for less than it should, and an outside
// reading found an ordinary object with `params`, `url` and `request` being
// reclassified, its own fields gone and nothing raised.
//
// So the shape lives here, once, and it is the real one: a `URL`, a `Request`,
// and the two members every event carries.
export const requestEvent = ({
    url = 'https://example.test/',
    params = {},
    method = 'GET',
    route = { id: '/' },
    ...rest
} = {}) => {
    const at = new URL(url);

    return {
        params,
        url: at,
        request: new Request(at, { method }),
        route,
        fetch: (...args) => globalThis.fetch(...args),
        setHeaders: () => {},
        ...rest
    };
};

// The same event as SvelteKit hands it over **while prerendering**: `url` is a
// proxy that throws from `searchParams`, because a page rendered at build time
// has no query string to read. It is the one member of an event that is not safe
// to touch, and therefore the one a recognition must never touch — `pyArg` wraps
// that read in a `try` and parses the URL again as a fallback, and a guard that
// read it first threw before the fallback could run.
//
// `refuses` says which members the framework guards. It defaults to the two a
// prerendered page really has no answer for, and takes others so the rule can be
// tested rather than hoped for: a guarded member must not *veto* the
// recognition, whichever member a future version decides to guard.
export const prerenderingEvent = ({ refuses = ['searchParams', 'search'], ...options } = {}) => {
    const one = requestEvent(options);
    const url = one.url;

    return {
        ...one,
        url: new Proxy(url, {
            get(target, key) {
                if (refuses.includes(key)) {
                    throw new Error(`Cannot access url.${String(key)} on a page with prerendering enabled`);
                }

                // `target` as the receiver, so the URL's own internal slots are
                // reachable from the accessors on its prototype.
                return Reflect.get(target, key, target);
            }
        })
    };
};

// The same event with a URL **from another JavaScript context**: an adapter, a
// worker, a `vm` context or an iframe builds it with that context's own `URL`
// constructor, so it answers everything a URL answers and `instanceof URL`
// against ours says false.
//
// Modelled with a proxy whose prototype is null, because failing `instanceof`
// while forwarding every read is the whole of what crossing a realm changes for
// a recognition. It is the shape that caught `instanceof` in the guard, where
// the comment one line away already said `instanceof` could not be trusted
// across realms for `Request`.
// Another realm's `URL.prototype`, which is an object sitting on *that* realm's
// `Object.prototype` — two steps from null, exactly like ours. `Object.create(null)`
// stood here and was one step, which makes it a bag of keys rather than the
// prototype of a class: a shortcut that stopped modelling a realm the moment the
// boundary learned to recognise one.
const elsewhere = Object.create(Object.prototype);

export const foreignRealmEvent = (options) => {
    const one = requestEvent(options);

    return {
        ...one,
        url: new Proxy(one.url, {
            // Another realm's `URL.prototype`, which is an object and is not
            // ours. `null` stood here and was a shortcut: it also made the URL
            // read as a bag of keys, which is the one thing a URL is not.
            getPrototypeOf: () => elsewhere,
            get: (target, key) => Reflect.get(target, key, target)
        })
    };
};
