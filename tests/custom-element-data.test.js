// **A custom element is handed the value its property takes.** Svelte sets a
// custom element's property to the value as it is, a custom element being, as
// Svelte tells one, an element whose name holds a dash or that an `is` names.
// Svelthon read a name of the boolean table there, `open` or `disabled`, for
// Python's truth, written by name or spread: `open={rows}` handed the element
// `True` and lost the list. And `hidden` kept its own wrapper there, and a
// `<svelte:element>` was never one, whether the name it renders was written
// out or is known only as it renders, which Svelte reads off the node. The
// witness is the same element in Svelte. On a standard element, the name is
// still read for Python's truth.
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

    // A `<svelte:element>` whose name becomes a custom element's as the page
    // runs: what it renders, and what its `open` is handed, before and after.
    const element = () => {
        const one = target.querySelector('[data-k="switched"]');

        return { name: one.localName, open: Array.isArray(one.open) ? [...one.open] : one.open };
    };
    const before = element();

    target.querySelector('[data-k="switch"]').click();
    flushSync();

    return {
        custom: {
            named: read('named', 'open'),
            empty: read('empty', 'open'),
            disabled: read('disabled', 'disabled'),
            spread: read('spread', 'open'),
            hidden: read('hidden', 'hidden'),
            dynamic: [read('dynamic', 'open'), read('dynamic', 'hidden')],
            shorthand: read('shorthand', 'hidden'),
            dynamicSpread: [read('dynamicSpread', 'open'), read('dynamicSpread', 'hidden')],
            switched: [before, element()]
        },
        standard: [read('standard', 'open'), read('dynamicStandard', 'open')]
    };
};

test("a custom element's property is handed the value, by name and spread, a `<svelte:element>`'s too", () => {
    const python = received(CustomElementData);
    const native = received(CustomElementDataNative);
    const list = ['a', 'b'];

    expect(python.custom).toEqual(native.custom);
    expect(python.custom).toMatchObject({
        named: list,
        hidden: list,
        dynamic: [list, list],
        shorthand: ['e'],
        dynamicSpread: [['c'], ['d']],
        // A `<details>` reads the list for its truth, and the custom element
        // that takes its place is handed the list.
        switched: [
            { name: 'details', open: true },
            { name: 'svelthon-probe', open: list }
        ]
    });
    // An empty list is false to Python, where JavaScript holds an array true,
    // on a standard element written out and on one rendered by name.
    expect([python.standard, native.standard]).toEqual([
        [false, false],
        [true, true]
    ]);
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

// A `<svelte:element>` whose `this` is text is told by that text, a dash in
// it, as Svelte tells it by the node's name, `is` aside; and one whose `this`
// is an interpolation between quotes is read as it renders, as a braced one
// is. Neither is mounted here: Svelte warns about a `this` written as text.
test("a `<svelte:element>`'s name told by its text, or read as it renders", () => {
    const compiled = (markup) => {
        const defs = [];
        const out = pythonExpressions(markup, collector(defs));

        return { out, defs: defs.map((one) => one.split('\n')[1].trim()) };
    };

    expect(compiled('<svelte:element this="my-list" open={data}></svelte:element>').defs).toEqual(['return __bound(data)']);
    expect(compiled('<svelte:element this="details" is="my-list" open={data}></svelte:element>').defs).toEqual(['return __truthy(data)']);

    const quoted = compiled('<svelte:element this="{tag}" open={data}></svelte:element>');

    expect(quoted.out).toBe(
        '{#each [__expr_0()] as SvelthonElement0}<svelte:element this={SvelthonElement0}  ' +
            'open={__pybridge.element(SvelthonElement0, "__truthy", __expr_py_1())}></svelte:element>{/each}'
    );
});
