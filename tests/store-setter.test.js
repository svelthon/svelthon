// @vitest-environment node
//
// A store is read *and written* from JavaScript, and the setter is the half no
// Python call ever goes through: `store.bump()` works whatever the setter says,
// which is exactly what hid this.
//
// The parameter was still named `v` while the body had moved to `__next`, so
// every published setter of every store answered `ReferenceError: __next is not
// defined` and the assignment did nothing. Found from the outside, by an audit
// that wrote to the store instead of calling it.
import { test, expect, describe } from 'vitest';

describe('a store written from JavaScript', () => {
    const load = () => import('./fixtures/counted.svelte.py');

    test('takes an assignment', async () => {
        const { store } = await load();

        store.count = 7;

        expect(store.count).toBe(7);
    });

    test('and a container, which stays a Python one', async () => {
        const { store } = await load();

        store.rows = ['a'];

        expect([...store.rows]).toEqual(['a']);
    });

    test('while its own function still works', async () => {
        const { store } = await load();

        store.count = 0;
        store.bump();

        expect(store.count).toBe(1);
    });
});

// The setter is a **crossing**, and it was the one crossing in the project that
// treated what it was handed as already Python. `store.amount = 0.25` put a raw
// JavaScript number where Python expected a float: `type(amount)` answered
// `JSObject` and `format(amount, ".2f")` raised *non-empty format string passed
// to object.__format__*, while `store.set_amount(0.25)` beside it worked. One
// value, two capabilities, decided by the door it came through.
//
// So the test is not a float: it is the two doors compared over the space of
// what can go through either, and the assertion is that they **agree**. An
// integer never showed it — Brython reads a JavaScript integer as an `int` — and
// that is why the existing tests above, which write `7` and `['a']`, stayed
// green through it.
describe('both doors into a store agree', () => {
    const load = () => import('./fixtures/store_doors.svelte.py');

    test.for([
        ['a float', 0.25],
        ['a negative float', -1.5],
        ['an integer', 3],
        ['a string', 'txt'],
        ['a boolean', true],
        ['null', null],
        // The identity of a foreign container is kept, on both doors: the
        // conversion a call owes is the scalar one, and converting containers
        // would be a change of contract rather than a repair.
        ['an array', [1, 2]],
        ['a plain object', { a: 1 }],
        ['a function', () => 1]
    ])('on %s', async ([, value]) => {
        const { store } = await load();

        const byCall = String(store.take(value));

        store.held = value;

        expect(String(store.describe())).toBe(byCall);
    });

    test('and a float assigned is a float, not a foreign object', async () => {
        const { store } = await load();

        store.held = 0.25;

        expect(String(store.describe())).toBe('float | 0.25');
    });

    test('while a foreign array keeps its identity', async () => {
        const { store } = await load();
        const rows = ['a'];

        store.held = rows;

        expect(store.held).toBe(rows);
    });
});
