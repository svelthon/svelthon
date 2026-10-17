// **A JavaScript absence, `undefined`, is Python's `None`, and `null` is
// `javascript.NULL`**, the engine's two pairings, on every path a value takes
// into Python: an argument of an exported function, and the fields of a route
// event's snapshot. These two handed `undefined` through, so `is None`
// answered false and the author's fallback was skipped.
//
// Asserted inside Python: a round trip hands each back as it was either way,
// and would pass throughout.
import { test, expect } from 'vitest';
import { absent, is_null as isNull, route_null, fallback } from './fixtures/absence.py';

const event = (slug) => ({
    fetch() {},
    url: new URL('https://example.test/'),
    request: new Request('https://example.test/'),
    route: { id: null },
    params: { slug }
});

test('undefined handed to a Python function is None, and null is javascript.NULL', () => {
    expect([absent(undefined), isNull(undefined)]).toEqual([true, false]);
    expect([absent(null), isNull(null)]).toEqual([false, true]);
});

test('while False, 0 and the empty string are values', () => {
    for (const value of [false, 0, '']) expect(absent(value)).toBe(false);
});

test('a null route id is null in the snapshot', () => {
    expect(route_null(event('x'))).toBe(true);
});

test('and an absent parameter takes the fallback the author wrote', () => {
    expect(fallback(event(undefined))).toBe('index');
    expect(fallback(event('article'))).toBe('article');
});
