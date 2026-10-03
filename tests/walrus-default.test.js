// A walrus in a destructuring default that binds a name of the pattern. The
// default reads the pattern's names through functions, so that one not bound
// yet is not read before its turn, and a walrus stores into the same name: what
// it stores is read by the reads after it, as Python reads it. Each row is the
// value CPython 3.14 gives the same expression, in a function whose parameter
// the name is, with the pattern's value as its default.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import WalrusDefault from './fixtures/WalrusDefault.svelte';

test.for([
    ['comprehension', '[3]:7'],
    ['generator', '[3]:7'],
    ['lambda-default', '3:7'],
    ['snippet', '[3]:7'],
    ['before-after', '[5, 3, 3]:5'],
    ['nested', '[4, 4]:5'],
    ['attribute', '[2, 2]:2'],
    ['identity', 'True'],
    ['lambda-body', '6:5']
])('a walrus in a default (%s) reads as CPython reads it', ([key, shown]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(WalrusDefault, { target });
    flushSync();

    expect(target.querySelector(`[data-k="${key}"]`).textContent).toBe(shown);
});
