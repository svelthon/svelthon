// A Python function keeps its attributes in a dictionary as an instance does,
// and state kept there repaints what reads it, as on an instance, the witness.
// A function was never watched: the model read `1|0` and the page `0|0`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { marks, track } from '../src/lib/runtime.js';
import FunctionState from './fixtures/FunctionState.svelte';

const shown = (kind, how) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(FunctionState, { target, props: { kind } });

    flushSync();
    instance.change(how);
    flushSync();

    return [instance.held(), target.querySelector('p').textContent];
};

test.for(['augmented', 'append', 'rebound', 'vars', 'dict', 'setattr'])(
    'a change written %s on a function repaints as on an instance',
    (how) => {
        const witness = shown('instance', how);

        expect(witness[1]).toBe(witness[0]);
        expect(shown('function', how)).toEqual(witness);
    }
);

// Python's functions only: one of JavaScript's is not ours to watch.
test('a JavaScript function a name holds is not watched', () => {
    const handler = () => {};

    track(handler, () => {}, () => {});

    expect(marks(handler)).toBeUndefined();
});
