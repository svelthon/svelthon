import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Crossing from './fixtures/Crossing.svelte';

// Each container, asked what it has become at each place it can cross out of the
// module that made it. A dict, a list and a set take three different paths
// through Brython's conversion, so the grid is filled for all three rather than
// for the one a bug was found in.
const read = (k) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Crossing, { target });
    flushSync();
    return target.querySelector(`p[data-k="${k}"]`).textContent;
};

// The module itself is a JavaScript object, which is the whole reason a call
// into it converts what it is given. Its function is a Python `function`, as
// CPython's `type(module.fn)` says: it was a `JavascriptFunction` called
// `wrapped`, the boundary's stand-in seen without the class it stands for.
test('a module is reached through JavaScript, its function a function', () =>
    expect(read('module')).toBe('JSObject / function'));

describe.each([
    ['dict', 'dict len=1'],
    ['list', 'list len=2'],
    ['set', 'set len=2']
])('a %s crossing a module boundary', (kind, intact) => {
    test('where it was made', () => expect(read(`${kind}-local`)).toBe(intact));

    // The direction Brython converts on: `$B.imported` holds a plain JavaScript
    // object, so the call takes its interop path and every argument goes
    // through `pyobj2jsobj`. `pyBoundary` hands back what the WeakMap recorded.
    test('handed to another module as an argument', () =>
        expect(read(`${kind}-argument`)).toBe(intact));

    test('read back out of another module', () => expect(read(`${kind}-read`)).toBe(intact));

    test('returned by another module', () => expect(read(`${kind}-returned`)).toBe(intact));

    test('passed down as a component prop', () => expect(read(`${kind}-prop`)).toBe(intact));
});

// And what the caller keeps afterwards. A converted dict reads through its
// JavaScript view from then on, so a nested list came back stripped of its
// class — in the caller's own value, after the call had returned.
test('a list nested in a dict is still a list after the call', () =>
    expect(read('nested')).toBe('list len=2'));
