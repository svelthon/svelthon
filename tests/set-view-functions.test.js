// A function read off the view of a Python set, against the same read on a
// `Set`. The view bound each function once per *name*, so a function put in
// its place afterwards was never the one called, and it bound it with the
// function's own `bind`, whatever the function held under that name.
import { test, expect } from 'vitest';
import * as sets from './fixtures/set_view_functions.py';

test.for([
    [
        'a method replaced after it was read',
        'replaced',
        (tags) => {
            tags.has(1);
            tags.has = () => false;
            return tags.has(1);
        }
    ],
    [
        'a function of its own replaced after it was read',
        'own',
        (tags) => {
            tags.describe = () => 'first';
            tags.describe();
            tags.describe = () => 'second';
            return tags.describe();
        }
    ],
    [
        'a function whose own bind is null',
        'bind_null',
        (tags) => {
            const method = () => 'real';
            method.bind = null;
            tags.describe = method;
            return tags.describe();
        }
    ],
    [
        'a function whose own bind hands back another',
        'bind_other',
        (tags) => {
            const method = () => 'real';
            method.bind = () => () => 'hijacked';
            tags.describe = method;
            return tags.describe();
        }
    ]
])('%s is called as on a Set', ([, name, run]) => {
    expect(sets[name]).toBeInstanceOf(Set);
    expect(run(sets[name])).toBe(run(new Set([1, 2])));
});

// And a method nobody replaced is one value, read after read.
test('an unchanged method is one function, read after read', () => {
    expect(sets.unchanged.has).toBe(sets.unchanged.has);
    expect(sets.unchanged.has(2)).toBe(true);
});
