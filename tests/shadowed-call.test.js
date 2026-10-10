// A JavaScript function is called as itself, as the engine calls it, and not
// through its `call` property, which is the author's to set: `callback.call =
// null` made a set view's `forEach` raise where a `Set`'s works, and a `then`
// whose `call` answered 99 turned an awaited 0.5 into 99. Each is held against
// the native object doing the same.
import { test, expect } from 'vitest';
import { tojson } from '../src/lib/helpers.js';
import { values, empty, passing, fresh } from './fixtures/shadowed_call.py';

const shadowed = (fn, call) => Object.assign(fn, { call });
const CALLS = [null, () => 99];

test.for(CALLS)('forEach calls the callback itself, its call being %s', (call) => {
    const seen = [];
    const native = [];

    values.forEach(shadowed((one) => seen.push(one), call));
    new Set([1, 2]).forEach(shadowed((one) => native.push(one), call));

    expect(seen.sort()).toEqual(native.sort());
});

test.for([null, undefined, { call: () => {} }])('forEach refuses %s before any row, as a Set does', (callback) => {
    expect(() => new Set().forEach(callback)).toThrow(TypeError);
    expect(() => empty.forEach(callback)).toThrow(TypeError);
    expect(() => values.forEach(callback)).toThrow(TypeError);
});

test('a set operation calls the other set’s has and keys themselves', () => {
    const other = () => ({
        size: 1,
        has: shadowed((one) => one === 1, null),
        keys: shadowed(function* () {
            yield 1;
        }, null)
    });

    for (const operation of ['union', 'intersection', 'difference', 'symmetricDifference']) {
        expect([...values[operation](other())].sort()).toEqual([...new Set([1, 2])[operation](other())].sort());
    }

    for (const operation of ['isSubsetOf', 'isSupersetOf', 'isDisjointFrom']) {
        expect(values[operation](other())).toBe(new Set([1, 2])[operation](other()));
    }
});

// A `values`, a `has` or a `size` JavaScript puts on a set's view is the
// view's, as on a `Set`, whose other methods read the set and not that member.
const OPERATIONS = {
    spread: (set) => [...set],
    keys: (set) => [...set.keys()],
    entries: (set) => [...set.entries()],
    forEach: (set) => {
        const seen = [];
        set.forEach((one) => seen.push(one));
        return seen;
    },
    union: (set) => [...set.union(new Set([2, 3]))],
    intersection: (set) => [...set.intersection(new Set([2, 3]))],
    difference: (set) => [...set.difference(new Set([2, 3]))],
    symmetricDifference: (set) => [...set.symmetricDifference(new Set([2, 3]))],
    isSubsetOf: (set) => set.isSubsetOf(new Set([1, 2, 3])),
    isSupersetOf: (set) => set.isSupersetOf(new Set([1])),
    isDisjointFrom: (set) => set.isDisjointFrom(new Set([1])),
    delete: (set) => [set.delete(1), delete set.has, set.has(1)]
};
const MEMBERS = {
    values: (set) => {
        set.values = function* () {
            yield 99;
        };
    },
    has: (set) => {
        set.has = () => false;
    },
    size: (set) => Object.defineProperty(set, 'size', { value: 0, configurable: true })
};

test.for(Object.keys(MEMBERS))('a %s put on a set’s view changes none of its other methods, as on a Set', (name) => {
    for (const [operation, run] of Object.entries(OPERATIONS)) {
        const native = new Set([1, 2]);
        const view = fresh();

        MEMBERS[name](native);
        MEMBERS[name](view);

        expect([operation, run(view)]).toEqual([operation, run(native)]);
    }
});

test('an awaited object’s then is called itself', async () => {
    const value = () => {
        const one = {
            answer: 0.5,
            then(resolve) {
                resolve(this.answer);
            }
        };

        one.then.call = (_self, resolve) => resolve(99);
        return one;
    };

    expect(await passing(value())).toBe(await value());
});

test('a toJSON is called itself', () => {
    const value = { toJSON: shadowed(() => 'written', null) };

    expect(tojson(value)).toBe(JSON.stringify(value));
});
