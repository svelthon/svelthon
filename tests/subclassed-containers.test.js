// A subclass that redefines nothing.
//
// Two containers were recognised by their exact class, and a subclass of either
// is an ordinary way to name a domain type — `class Bag(set)`, `class
// Mapping(dict)`. Neither of these overrides a method, which is what makes them
// a control: what differs between them and the builtin is the framework's
// decision and nothing of the author's.
//
// A `dict` subclass has an instance `__dict__` beside its entries, so the
// converter took the instance path and returned before ever reading the
// mapping: `Mapping({"answer": 42})` crossed as `{}`, and with one attribute
// set, as `{label: "metadata"}` — the business data replaced by its own
// metadata, no error, valid JSON.
//
// A `set` subclass failed an equality test against `set` and `frozenset`, so its
// members were never taken under watch.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SetSubclass from './fixtures/SetSubclass.svelte';

describe('a dict subclass', () => {
    const mod = () => import('./fixtures/subclassed.py');

    // The control Python itself gives, read before anything crosses.
    test('holds the entry Python says it holds', async () => {
        expect((await mod()).keys_before()).toEqual(['answer']);
    });

    test('crosses as its entries, like the builtin it subclasses', async () => {
        const { mapping, plain } = await mod();

        expect(mapping()).toEqual(plain());
        expect(mapping()).toEqual({ answer: 42 });
    });

    // A dict is its entries. An attribute on the instance is metadata about the
    // mapping and never an entry of it, which is the rule CPython's own `json`
    // follows for a dict subclass.
    test('and an attribute beside them does not replace them', async () => {
        expect((await mod()).decorated()).toEqual({ answer: 42 });
    });

    test('one level down as well', async () => {
        expect((await mod()).nested()).toEqual({ rows: { answer: 42 } });
    });

    // The graph rule holds on this path too.
    test('and a shared value stays one value', async () => {
        const out = (await mod()).shared();

        // The value first: `undefined === undefined` would have made the
        // identity below true while both entries were missing.
        expect(out.a).toEqual([1]);
        expect(out.a).toBe(out.b);
    });
});

describe('a set subclass', () => {
    test('has its members watched, like the builtin it subclasses', () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(SetSubclass, { target });
        flushSync();

        const read = () => target.querySelector('[data-k="total"]').textContent;

        expect(read()).toBe('0');

        target.querySelector('button[data-k="bump"]').click();
        flushSync();

        expect(read()).toBe('1');
    });
});
