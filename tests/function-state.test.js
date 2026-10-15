// A Python function or class keeps its attributes in a dictionary as an
// instance does, and state kept there repaints what reads it, as on an
// instance, the witness. Neither was watched: the model read `1|0` and the page
// `0|0`. A class's dictionary refuses a write of its own (`mappingproxy`), so
// it is written to by attribute only.
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

const BY_ATTRIBUTE = ['augmented', 'append', 'rebound', 'setattr'];

test.for([
    ...[...BY_ATTRIBUTE, 'vars', 'dict'].map((how) => ['function', how]),
    ...BY_ATTRIBUTE.map((how) => ['class', how])
])('a change written on a %s, %s, repaints as on an instance', ([kind, how]) => {
    const witness = shown('instance', how);

    expect(witness[1]).toBe(witness[0]);
    expect(shown(kind, how)).toEqual(witness);
});

test('a class watched is still the class', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(FunctionState, { target, props: { kind: 'class' } });

    flushSync();
    instance.change('augmented');
    flushSync();

    expect(instance.still_a_class()).toBe(true);
});

// Python's functions only: one of JavaScript's is not ours to watch.
test('a JavaScript function a name holds is not watched', () => {
    const handler = () => {};

    track(handler, () => {});

    expect(marks(handler)).toBeUndefined();
});

// The author's classes only: the engine's have nothing to watch.
test("a class of the engine's a name holds is not watched", () => {
    const list = globalThis.__BRYTHON__.builtins.list;

    track(list, () => {});

    expect(marks(list)).toBeUndefined();
});
