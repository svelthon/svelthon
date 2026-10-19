// **A custom element is handed the value its property takes.** Svelte sets a
// custom element's property to the value as it is, a custom element being, as
// Svelte tells one, an element whose name holds a dash or that an `is` names.
// Svelthon read a name of the boolean table there, `open` or `disabled`, for
// Python's truth, written by name or spread: `open={rows}` handed the element
// `True` and lost the list. The witness is the same element in Svelte. On a
// standard element, the name is still read for Python's truth.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';
import '../src/lib/compile.cjs';
import CustomElementData from './fixtures/CustomElementData.svelte';
import CustomElementDataNative from './fixtures/CustomElementDataNative.svelte';

const received = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();

    const read = (k, property) => {
        const value = target.querySelector(`[data-k="${k}"]`)[property];

        return Array.isArray(value) ? [...value] : value;
    };

    return {
        named: read('named', 'open'),
        empty: read('empty', 'open'),
        disabled: read('disabled', 'disabled'),
        spread: read('spread', 'open'),
        standard: read('standard', 'open')
    };
};

test("a custom element's property is handed the value, by name and spread", () => {
    const python = received(CustomElementData);
    const native = received(CustomElementDataNative);

    expect({ ...python, standard: undefined }).toEqual({ ...native, standard: undefined });
    expect(python.named).toEqual(['a', 'b']);
    // An empty list is false to Python, where JavaScript holds an array true.
    expect([python.standard, native.standard]).toEqual([false, true]);
});

// An element an `is` names is one too, as Svelte tells it: the value crosses
// as a prop's does, and a standard element's crosses for its truth.
test('an element an `is` names is a custom element', () => {
    const read = (markup) => {
        const defs = [];

        pythonExpressions(markup, collector(defs));

        return defs[0].split('\n')[1].trim();
    };

    expect([read('<button is="my-button" disabled={data}></button>'), read('<button disabled={data}></button>')]).toEqual([
        'return __bound(data)',
        'return __truthy(data)'
    ]);
});
