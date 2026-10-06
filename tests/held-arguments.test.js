import { test, expect } from 'vitest';
import * as python from './fixtures/held_arguments.py';
import { kept_value, push_to } from './fixtures/held_arguments.js';

// A Python container handed to a JavaScript function is Python's own, as a
// JavaScript caller hands its array: a library that keeps it, a chart its data,
// reads what Python appends later, and what it pushes is Python's. A copy was
// made at the call, and both were lost. By a named import and through `js`
// alike, since both convert at one site (`outbound`).
test('a container a JavaScript library keeps is the one Python changes', () => {
    python.hand();
    python.grow();

    expect([...kept_value('rows')]).toEqual([1, 2]);
    expect({ ...globalThis.heldRecord }).toEqual({ count: 1 });
    expect([...globalThis.heldRows]).toEqual([1, 2]);

    push_to('rows', 3);
    expect([...python.rows]).toEqual([1, 2, 3]);

    // One container, one object, within a call as across calls.
    expect(python.twice()).toBe(true);
});

// A view is a proxy, which `structuredClone` refuses as it refuses Svelte's
// `$state`; `to_js` is the copy an API that clones takes, as `$state.snapshot`
// is.
test('to_js is the copy an API that clones takes', () => {
    python.hand();

    expect(() => structuredClone(kept_value('rows'))).toThrow();

    python.snapshot();
    expect(structuredClone(kept_value('snapshot'))).toEqual([...python.rows]);
});
