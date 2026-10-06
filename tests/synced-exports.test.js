import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import * as python from './fixtures/synced_exports.py';
import * as native from './fixtures/synced_exports_native.js';
import SyncedInstanceHost from './fixtures/SyncedInstanceHost.svelte';
import * as held from './fixtures/js_held_instances.py';
import PrintedHost from './fixtures/PrintedHost.svelte';
import PrintedNative from './fixtures/PrintedNative.svelte';

// What a module exports is its own object, as a JavaScript module's export is
// and as `m.items` is in Python: changed in place by the module, it is changed
// for the importer, under the name and in a reference taken before. A copy
// followed the name alone, and `items.append(1)` left JavaScript reading `[0]`.
// The module written in JavaScript is the witness.
const SHAPES = ['items', 'record', 'nested', 'rows', 'table', 'thing'];

const read = (module) => JSON.parse(JSON.stringify(Object.fromEntries(SHAPES.map((name) => [name, module[name]]))));

test('a container or an instance a module changes in place is changed for its importer', () => {
    const held = { python: { ...python }, native: { ...native } };

    python.mutate();
    native.mutate();

    expect(read(python)).toEqual(read(native));
    expect(read(held.python)).toEqual(read(held.native));
    expect(read(python).items).toEqual([0, 1]);
    expect(python.thing.double()).toBe(native.thing.double());
});

test('and a write from the importer is the module’s', () => {
    python.items.push(5);
    python.record.count = 7;
    python.thing.count = 3;

    expect(python.seen()).toEqual({ items: [0, 1, 5], record: { count: 7 }, thing: 3 });
});

// An instance Python writes into a JavaScript object or array is its view
// there too, as every other Python value written there is converted: the
// object then leaves Python as itself, and what it holds reads, serialises and
// comes back as the instance. Written raw, `config.inst.x` was `undefined` and
// `JSON.stringify` refused a circular structure.
test('an instance written into a JavaScript object reads as itself', () => {
    expect(held.config.inst.x).toBe(1.5);
    expect(held.config.inst.double()).toBe(3);
    expect(JSON.parse(JSON.stringify(held.config))).toEqual({ inst: { x: 1.5 } });
    expect(held.rows[0].x).toBe(2.5);
    expect(held.make().inst.x).toBe(3.5);
    expect(held.same(held.config.inst)).toBe(true);
});

// The same instance prints alike in the Python template and in a JavaScript
// child: a class with a `__str__` prints by it, as a JavaScript class with a
// `toString` does, and one with neither prints as an object on both sides. A
// change Python makes repaints the child.
test('an instance prints in a JavaScript child as its class says', () => {
    const shown = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        const host = mount(Component, { target });
        flushSync();

        const text = (key) => target.querySelector(`[data-k="${key}"]`).textContent;

        return { host, text, all: ['python', 'price', 'literal', 'plain'].map(text) };
    };

    const python = shown(PrintedHost);

    expect(python.all).toEqual(shown(PrintedNative).all);
    expect(python.all).toEqual(['1.50 EUR', '1.50 EUR', '1.50 EUR', '[object Object]']);

    python.host.raise_price();
    flushSync();
    expect(python.text('price')).toBe('2.50 EUR');
});

// The instance's view is also what a JavaScript child reads of a prop: handed
// raw, it read nothing, the attributes being under a symbol of Brython's.
test('a JavaScript child reads, follows and writes an instance it is given', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(SyncedInstanceHost, { target });
    flushSync();

    const shown = () => target.querySelector('[data-k="count"]').textContent;

    expect(shown()).toBe('0');

    host.bump();
    flushSync();
    expect(shown()).toBe('1');

    target.querySelector('[data-k="add"]').click();
    flushSync();
    expect(host.count()).toBe(11);
    expect(shown()).toBe('11');
});
