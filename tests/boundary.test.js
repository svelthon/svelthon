import { test, expect, describe } from 'vitest';
import { mount } from 'svelte';
import JsBoundary from './fixtures/JsBoundary.svelte';

// A Python function handed to JavaScript — the handler behind a `query()`, a
// `command()`, any function named in `__js__` or imported by the component's
// `<script module>`. JavaScript calls with whatever it has; Python refuses a
// positional argument it never declared. The boundary exists so the author has
// nothing to write: `query(accepted)` in Python must read like `query(accepted)`
// in TypeScript.
describe('boundary towards JavaScript', () => {
    const render = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(JsBoundary, { target });
        return (key) => target.querySelector(`p[data-k="${key}"]`).textContent;
    };

    test('a Python callback survives a JavaScript call that is too wide', () => {
        // twice() passes two arguments, double() declares one. Without the
        // trim: TypeError, and the whole page fails.
        expect(render()('total')).toBe('30');
    });

    test('*args takes everything JavaScript sends', () => {
        // The opposite case: nothing to trim, the signature swallows it all.
        expect(render()('starred')).toBe('a-b-c');
    });

    test('a Python container arrives as JavaScript data', () => {
        // Without conversion, JSON.stringify would see the symbol-keyed
        // internals of a Brython dict — or nothing at all.
        expect(render()('payload')).toBe('{"a":[1,2],"b":null}');
    });

    test('a name keeps its identity from one read to the next', () => {
        // Wrapping on every read would make `f is f` false, which is nonsense
        // in Python.
        expect(render()('identity')).toBe('yes');
    });

    test('to_python is defined inside a component', () => {
        // It was bound to a `pyArg` the component script never imported: a
        // ReferenceError on first read, and only on that one.
        expect(render()('to_python')).toBe('yes');
    });
});
