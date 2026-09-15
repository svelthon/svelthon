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
