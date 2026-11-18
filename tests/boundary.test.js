import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import JsBoundary from './fixtures/JsBoundary.svelte';

// The boundary as JavaScript sees it: a `<script module>` calling back into
// Python, which is the shape SvelteKit uses everywhere — a framework function
// handed a Python handler, and a Python value handed to a framework function.
describe('a JavaScript module calling into Python', () => {
    const read = (k) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(JsBoundary, { target });
        flushSync();

        return target.querySelector(`p[data-k="${k}"]`).textContent;
    };

    // `twice` calls its handler with two arguments; `double(n)` declares one.
    // JavaScript ignores the extra, and so must the crossing — otherwise every
    // callback would have to declare parameters it never reads.
    test('a handler is called with its declared arity', () => {
        expect(read('total')).toBe('30');
    });

    // What a Python value looks like to `JSON.stringify`: a dict is an object,
    // a list an array, and None is `undefined`, which it leaves out as it leaves
    // out any `undefined`, rather than an object that serialises as `{}`. JSON
    // that keeps it as `null` is `to_json`'s.
    test('a dict, a list and None serialise as JavaScript expects', () => {
        expect(read('payload')).toBe('{"a":[1,2]}');
    });

    // The other direction of arity: `joined(*pieces)` takes as many as it is
    // given, so nothing may be trimmed there.
    test('a starred signature keeps every argument', () => {
        expect(read('starred')).toBe('a-b-c');
    });

    // Read twice, the same object: Python compares functions by identity, and a
    // fresh wrapper on every read would break `is` and any cache keyed on it.
    test('a JavaScript function keeps its identity across reads', () => {
        expect(read('identity')).toBe('yes');
    });

    test('and the injected names are in scope beside them', () => {
        expect(read('to_py')).toBe('yes');
    });
});
