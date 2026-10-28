// **A snippet's positional pattern takes a Python iterable apart as Python
// does**: `__pybridge.positional` asked for JavaScript's protocol alone, which a
// `range`, a generator, an iterator and an instance's `__iter__` do not have,
// so `[a, b]` read two empty positions and rendered `:` without a word. A
// generator is walked as far as the pattern reads, its third step never taken.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PositionalPythonIterables from './fixtures/PositionalPythonIterables.svelte';

test('a positional pattern takes a Python iterable apart as Python does', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(PositionalPythonIterables, { target });
    flushSync();

    expect(Object.fromEntries([...target.querySelectorAll('output')].map((one) => [one.dataset.k, one.textContent]))).toEqual({
        range: '10:20',
        generator: '10:20',
        iterator: '10:20',
        instance: '10:20',
        list: '10:20'
    });
});
