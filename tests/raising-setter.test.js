// A setter that writes and then raises.
//
// The attribute path called the setter, and notified afterwards. Every other
// mutation path learned long ago that an exception does not undo what happened
// before it — `xs.extend(values())` keeps what the generator yielded, `d |=
// values()` keeps the entries it inserted — and both notify in a `finally`.
// `__setattr__` did not: the author caught the error, the model held 1, and the
// page held 0.
//
// One fixture, two boxes, and a flag chooses which raises: the witness is the
// same setter without the `raise`.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import RaisingSetter from './fixtures/RaisingSetter.svelte';

describe.for([
    ['that raises after writing', 'angry'],
    ['that returns normally', 'calm']
])('an attribute written by a setter %s', ([, key]) => {
    test('repaints what reads it', () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(RaisingSetter, { target });
        flushSync();

        const read = () => target.querySelector(`[data-k="${key}-value"]`).textContent;

        expect(read()).toBe('0');

        target.querySelector(`button[data-k="${key}"]`).click();
        flushSync();

        expect(read()).toBe('1');
    });
});

// And the deletion beside it, which kept the old shape while the write was being
// repaired: `__delattr__` may remove the attribute and then raise, and the
// exception does not put it back.
describe.for([
    ['that raises after deleting', 'angry'],
    ['that returns normally', 'calm']
])('an attribute removed by a deleter %s', ([, key]) => {
    test('repaints what reads it', () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(RaisingSetter, { target });
        flushSync();

        const read = () => target.querySelector(`[data-k="${key}-has"]`).textContent;

        expect(read()).toBe('True');

        target.querySelector(`button[data-k="drop-${key}"]`).click();
        flushSync();

        expect(read()).toBe('False');
    });
});
