// **A JavaScript absence is Python's `None`**, on every path a value takes into
// Python: an argument of an exported function, and the fields of a route
// event's snapshot. The explicit conversion already had the rule; these two
// handed `null` and `undefined` through, so `is None` answered false and the
// author's fallback was skipped.
//
// Asserted inside Python: a round trip hands `null` back as `null` either way,
// and would pass throughout.
import { test, expect } from 'vitest';
import { absent, route_absent, fallback } from './fixtures/absence.py';

const event = (slug) => ({
    fetch() {},
    url: new URL('https://example.test/'),
    request: new Request('https://example.test/'),
    route: { id: null },
    params: { slug }
});

test.for([['null', null], ['undefined', undefined]])('%s handed to a Python function is None', ([, value]) => {
    expect(absent(value)).toBe(true);
});

test('while False, 0 and the empty string are values', () => {
    for (const value of [false, 0, '']) expect(absent(value)).toBe(false);
});

test('an absent route id is None in the snapshot', () => {
    expect(route_absent(event('x'))).toBe(true);
});

test('and an absent parameter takes the fallback the author wrote', () => {
    expect(fallback(event(undefined))).toBe('index');
    expect(fallback(event('article'))).toBe('article');
});
