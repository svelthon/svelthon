import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import * as python from './fixtures/synced_exports.py';
import * as native from './fixtures/synced_exports_native.js';
import SyncedInstanceHost from './fixtures/SyncedInstanceHost.svelte';
import * as held from './fixtures/js_held_instances.py';
import PrintedHost from './fixtures/PrintedHost.svelte';
import PrintedNative from './fixtures/PrintedNative.svelte';
import * as sets from './fixtures/synced_sets.py';
import * as nativeSets from './fixtures/synced_sets_native.js';
import SetHost from './fixtures/SetHost.svelte';

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

// A set reads as a `Set`, which is how JavaScript holds one: exported, written
// into a JavaScript object and handed as a prop, it was the Brython object, on
// which `has` and `size` do not exist. The module written in JavaScript is the
// witness, `instanceof Set` and the set algebra included.
const setShape = (module) => ({
    set: module.tags instanceof Set,
    has: [module.tags.has('a'), module.tags.has('b'), module.tags.has('z')],
    size: module.tags.size,
    members: [...module.tags].sort(),
    boxed: [module.box.tags instanceof Set, module.box.tags.has?.('b'), [...module.box.tags].sort()],
    frozen: [...module.frozen].sort(),
    union: [...module.tags.union(new Set(['c']))].sort(),
    intersection: [...module.tags.intersection(new Set(['b', 'z']))],
    subset: module.tags.isSubsetOf(new Set(['a', 'b', 'c']))
});

test('a set reads, follows and is written as a JavaScript Set', () => {
    const held = { python: sets.tags, native: nativeSets.tags };

    sets.mutate();
    nativeSets.mutate();

    expect(setShape(sets)).toEqual(setShape(nativeSets));
    expect(setShape(sets).members).toEqual(['a', 'b']);
    expect([...held.python].sort()).toEqual([...held.native].sort());

    sets.tags.add('c');
    sets.tags.delete('a');
    expect(sets.seen()).toEqual(['b', 'c']);

    // A member that is a tuple reads as a tuple does, and finds itself.
    const [pair] = [...sets.pairs];
    expect([...pair]).toEqual([1, 2]);
    expect(sets.pairs.has(pair)).toBe(true);

    // A frozenset refuses a write, as Python does.
    expect(() => sets.frozen.add(3)).toThrow();
});

test('a JavaScript child reads and follows a set it is given', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(SetHost, { target });
    flushSync();

    const shown = () => target.querySelector('[data-k="picked"]').textContent;

    expect(shown()).toBe('a 1 false');

    host.pick('b');
    flushSync();
    expect(shown()).toBe('a,b 2 true');
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
