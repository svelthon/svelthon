// When the mutator was taken off the object.
//
// Wrapping a mutator was decided at the **read**: if the object was not watched
// at that moment, the raw method was handed over and the decision was never
// revisited. A factory that returns its state and an operation on it — `values,
// add = make()` — hands the operation out before the state has a name, so the
// list became reactive afterwards and `add(1)` never told anyone.
//
// The witness takes the same method off the same kind of list, one line after
// the module-level assignment that makes it reactive. It repainted throughout,
// which is what says this is about *when* and not about the mutation.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import EarlyCapture from './fixtures/EarlyCapture.svelte';
import LateCapture from './fixtures/LateCapture.svelte';

describe.for([
    ['before anything watches the list', EarlyCapture],
    ['after the list became reactive', LateCapture]
])('a mutator taken off the object %s', ([, Component]) => {
    test('repaints what reads it', () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(Component, { target });
        flushSync();

        const read = () => target.querySelector('[data-k="total"]').textContent;

        expect(read()).toBe('0');

        target.querySelector('button[data-k="go"]').click();
        flushSync();

        expect(read()).toBe('1');
    });
});
