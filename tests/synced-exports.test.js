import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import * as python from './fixtures/synced_exports.py';
import * as native from './fixtures/synced_exports_native.js';
import SyncedInstanceHost from './fixtures/SyncedInstanceHost.svelte';

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
