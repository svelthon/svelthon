//
// Two questions asked of a value's *shape* where the answer belongs to its
// *class*, and they are the same defect twice.
//
// **A list subclass that redefines `__iter__`.** A Brython list is a JavaScript
// array, so `{#each}` walked the storage: `[x for x in rows]` answered `[3, 2, 1]`
// in Python while the loop beside it showed `123`, for one object. The storage
// stops being the sequence the moment an author says what iterating means.
// `batch` shared the cause, since both go through `seq`.
//
// **A foreign object carrying a field called `ob_type`.** That name is Brython's
// mark, and data is free to be spelled the same: `urlencode({ob_type: "business",
// value: 42})` answered `%5Bobject%20Object%5D` — every parameter gone — while
// the identical Python dict encoded correctly. The question is *is this a Python
// object*, and `pyClass` is what the rest of the project asks; the inbound
// converter had the same repair when it read `ob_type === undefined`.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { python_order, encoded, batched, converted } from './fixtures/iterating_subclass.py';
import IteratingSubclass from './fixtures/IteratingSubclass.svelte';

describe('a list subclass with its own __iter__', () => {
    test('Python and the boundary agree on what it holds', () => {
        expect(python_order()).toEqual([3, 2, 1]);
    });

    test('and the loop that renders it shows that order', () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(IteratingSubclass, { target });
        flushSync();

        const read = (k) => target.querySelector(`[data-k="${k}"]`).textContent;

        expect(read('custom')).toBe('321');
        // The control beside it: an ordinary list, unchanged.
        expect(read('plain')).toBe('123');
        expect(read('python')).toBe('[3, 2, 1]');
    });

    test('and a helper that walks it sees the same order', () => {
        const [custom, plain] = batched();

        expect(custom).toBe('[[3, 2], [1]]');
        // The control: an ordinary list, whose storage *is* its sequence.
        expect(plain).toBe('[[1, 2], [3]]');
    });
});

describe('a field spelled like the engine’s mark', () => {
    // And the same collision on an **array**, where the inbound converter kept
    // the wider test one branch longer: `to_py(rows)` handed the array straight
    // back, so what came out was not a `list` and the `.get` beside it raised
    // `AttributeError`. An array is as free to carry that field name as an
    // object is, and the question is the same one — is this a Python class.
    test('on an array too, which still arrives as a list', () => {
        const [tagged, plain] = converted();

        expect(tagged).toBe('list');
        // The control: the same array without that field, never in doubt.
        expect(plain).toBe(tagged);
    });

    test('is data, and every parameter survives', () => {
        const [foreign, python, control] = encoded();

        expect(foreign).toBe('ob_type=business&value=42');
        // The same information written as a Python dict, which always worked,
        // and the same object without that name, which was never in doubt.
        expect(python).toBe(foreign);
        expect(control).toBe('kind=business&value=42');
    });
});
