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

// A member JavaScript adds to the view is the view's, its `this` the view, as
// on a `Set`: it was bound to the object behind the view, which then leaked
// out, and `structuredClone` copied that one as an empty set.
test('a method and a getter put on the view see the view as this', () => {
    const tags = sets.receiver;

    tags.self = function () {
        return this;
    };
    expect(tags.self()).toBe(tags);
    expect(() => structuredClone(tags.self())).toThrow();

    Object.defineProperty(sets.getter, 'same', {
        get() {
            return this === sets.getter;
        }
    });
    expect(sets.getter.same).toBe(true);
});

// A function defined locked, or frozen in afterwards, reads as itself: the view
// handed back another function, which a non-configurable property forbids,
// and the read raised.
test('a locked or frozen function on the view still reads, as on a Set', () => {
    Object.defineProperty(sets.locked, 'describe', { value: () => 'real' });
    expect(sets.locked.describe()).toBe('real');

    sets.frozen.describe = () => 'real';
    Object.freeze(sets.frozen);
    expect(sets.frozen.describe()).toBe('real');
    expect(sets.frozen.has(1)).toBe(true);
});

// The set's own methods still run on what it holds, and answer the view.
test('its own methods answer the view', () => {
    const tags = sets.added;
    let third;

    expect(tags.add(3)).toBe(tags);
    tags.forEach((one, again, set) => {
        third = set;
    });
    expect(third).toBe(tags);
});

// And a method nobody replaced is one value, read after read.
test('an unchanged method is one function, read after read', () => {
    expect(sets.unchanged.has).toBe(sets.unchanged.has);
    expect(sets.unchanged.has(2)).toBe(true);
});
