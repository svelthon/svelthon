import { test, expect, describe, beforeEach } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Urls from './fixtures/Urls.svelte';
import QueryItems from './fixtures/QueryItems.svelte';

// Liquid, Django and Jinja all spell it `urlencode`, and a template only ever
// needs the encoding half: decoding is an input operation, and only Liquid ships
// one — a Shopify theme has no code in front of it.
//
// Jinja's shape is kept (a string, or a mapping that becomes a query string) and
// its behaviour is not: both it and Django leave `/` unquoted, which turns
// `/tag/{urlencode(t)}` into two segments. Jinja does not agree with itself
// either — its string form yields `a/b` and its mapping form `p=a%2Fb`.
describe('urlencode', () => {
    // Once per test rather than once per file, so the component is torn down
    // with the test that made it.
    let read;

    beforeEach(() => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(Urls, { target });
        flushSync();

        read = (k) => target.querySelector(`[data-k="${k}"]`);
    });

    test('a value is escaped for a URL', () => {
        expect(read('piece').textContent).toBe('caf%C3%A9%20%26%20th%C3%A9');
    });

    test('a slash too, where Django and Jinja let it through', () => {
        expect(read('slash').textContent).toBe('a%2Fb');
    });

    test('a mapping becomes a whole query string', () => {
        expect(read('query').textContent).toBe('q=caf%C3%A9+%26+th%C3%A9&page=2');
    });

    test('and the two forms agree, which Jinja\'s do not', () => {
        expect(read('slash-in-dict').textContent).toBe('p=a%2Fb');
    });

    test('a value that is not a string goes through str() first', () => {
        expect(read('number').textContent).toBe('703');
    });

    test('it is usable in an href, in both positions', () => {
        expect(read('link').getAttribute('href')).toBe('/search?q=caf%C3%A9+%26+th%C3%A9');
        expect(read('path').getAttribute('href')).toBe('/tag/a%2Fb');
    });
});

// A dict whose class says what its items are is read through `items()`, as
// CPython's `urlencode` and `json.dumps` read it, on the page and through an
// export alike: the storage carried `tag=stale&page=2`.
test('a dict’s items() is what the page encodes', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(QueryItems, { target });
    flushSync();

    const read = (k) => target.querySelector(`[data-k="${k}"]`).textContent;

    expect(read('query')).toBe('tag=selected');
    expect(JSON.parse(read('json'))).toEqual({ tag: 'selected' });
    expect(read('refused')).toBe('raises: query items failed');
    expect(instance.read()).toBe('tag=selected');
});
