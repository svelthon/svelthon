import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BuiltinNames from './fixtures/BuiltinNames.svelte';
import { reads, untouched } from './fixtures/builtin_names.py';

// A JavaScript import spelled like a builtin is the import wherever Python reads
// it, as `from m import max` is in Python: Brython took a name nothing in the
// module bound for the builtin, at compile time, so `max(1, 2)` answered 2
// whatever `__js__` or `importjs` had brought.
test('a builtin name a .py imports from JavaScript is the import', () => {
    expect(reads()).toEqual([
        'javascript max of 2',
        'javascript max of 1',
        'javascript object',
        'javascript max of 0',
        'javascript object'
    ]);
    expect(untouched()).toEqual(['1', '3']);
});

test('and in a component, by importjs, by its module script and in its markup', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(BuiltinNames, { target });
    flushSync();

    expect(instance.reads()).toEqual(['javascript max of 1', 'javascript object', 'javascript len', '1']);
    expect(target.querySelector('[data-k="markup"]').textContent).toBe('javascript max of 2');
});
