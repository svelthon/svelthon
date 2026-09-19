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
