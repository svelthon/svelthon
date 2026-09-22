// **A default in a pattern reads a name when Python reaches it.**
//
// The names a template expression reads are handed to its function as
// arguments, and an argument is evaluated before the call. In a default that is
// too early: a later name of the same pattern is still in JavaScript's temporal
// dead zone, so `[first=1 if True else second, second=2]` raised `Cannot access
// 'second' before initialization` out of a branch Python never takes. So a
// default gets each name as a function that reads it, and the compiler turns its
// reads into calls.
//
// Reaching a later name for real still raises, as it does in JavaScript; that
// row is in `tests/pattern-scope.test.js`.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import LazyDefault from './fixtures/LazyDefault.svelte';

const rendered = () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(LazyDefault, { target });
    flushSync();

    return Object.fromEntries(
        [...target.querySelectorAll('i')].map((one) => [one.dataset.k, one.textContent.trim()])
    );
};

describe('a default reads a name when Python reaches it', () => {
    test.for([
        ['a branch Python does not take', 'untaken', '1:2'],
        ['a short circuit', 'short-circuit', '1:2']
    ])('%s reads nothing', ([, key, answer]) => {
        expect(rendered()[key]).toBe(answer);
    });

    // The reads rewritten follow Python's scopes: what a lambda or a
    // comprehension binds for itself is its own, and what it reads from outside
    // is the pattern's name, read when it is reached.
    test.for([
        ['a comprehension reads its first iterable outside', 'iterable', '[1, 2]'],
        ['a lambda reads its defaults outside', 'lambda-default', '8'],
        ['a keyword-only parameter is the lambda s own', 'keyword-only', '3'],
        ['and so is a variadic one', 'variadic', '(1, 2)'],
        ['each target binds for what follows it', 'generators', '[(1, 1), (2, 2)]'],
        ['and a lambda that shadows nothing reads the name', 'no-collision', '8']
    ])('%s', ([, key, answer]) => {
        expect(rendered()[key]).toBe(answer);
    });

    // The value a function hands back is the value itself, whatever it is: read
    // through the default and read directly are the same object.
    test.for([
        ['a list', 'row-0', 'list:list:True:True'],
        ['a dict', 'row-1', 'dict:dict:True:True'],
        ['None', 'row-2', 'NoneType:NoneType:True:True'],
        ['an int past 2^53', 'row-3', 'int:int'],
        ['a str', 'row-4', 'str:str']
    ])('and %s comes back as itself', ([, key, answer]) => {
        expect(rendered()[key]).toMatch(new RegExp(`^${answer}`));
    });
});
