import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import KeyedRowsReader from './fixtures/KeyedRowsReader.svelte';
import { store } from './fixtures/shared_rows.svelte.py';

// Python's first read of what JavaScript handed a store changes nothing a page
// holds: the array and each row stay the objects the page read, as Svelte's
// proxies stay, so a field keyed by its row keeps its node and what was typed
// in it when the list is written again. The getter handed the view of Python's
// list after a mere `len(rows)`, and the field was made anew, empty.
test('a page keeps its rows, and a keyed field what was typed, after Python reads them', () => {
    const target = document.body.appendChild(document.createElement('div'));

    store.rows = [{ n: 1 }];
    mount(KeyedRowsReader, { target });
    flushSync();

    const field = target.querySelector('input');
    const rows = store.rows;
    const row = store.rows[0];

    field.value = 'draft';
    expect(store.size()).toBe(1);

    const kept = [store.rows === rows, store.rows[0] === row];

    store.rows = [...store.rows];
    flushSync();

    const now = target.querySelector('input');

    expect([...kept, store.rows[0] === row, now === field, now.value]).toEqual([true, true, true, true, 'draft']);
});

// And whichever way Python hands back a row a page read, a function's result, a
// container Python filled, a list Python sorted anew, it is that row, as
// Svelte's proxy is wherever it went. Handed as the view of what Python made of
// it, it was another object.
test('a row a page read is the row Python hands back, by any way', () => {
    store.rows = [{ n: 1 }, { n: 2 }];

    const row = store.rows[0];
    const first = store.first();

    store.keep_first();

    const kept = store.kept.first;

    store.resort();

    expect([first === row, kept === row, store.rows[1] === row]).toEqual([true, true, true]);
});

// One object in two places is two copies, as Svelte's state makes two, whoever
// reads first: what a Python write does no longer hangs on what a page showed.
// Python's conversion shared the object it met twice, where a page's read of a
// place had made it a copy of its own.
test.for([
    ['nothing read first', false],
    ['a page reading a place first', true]
])('one object in two places is two copies, %s', ([, readFirst]) => {
    const source = { n: 1 };

    store.rows = [source, source];
    if (readFirst) expect(store.rows[0].n).toBe(1);

    expect(store.same()).toBe(false);

    store.write_first(6);

    expect([store.second_n(), store.rows[1].n, store.rows[0].n, source.n]).toEqual([1, 1, 6, 1]);
});

// And one an object holds inside itself is that object, a cycle as it was:
// copies of it would never end.
test('an object that holds itself is one object to Python', () => {
    const looped = { n: 1 };

    looped.self = looped;
    store.rows = [looped];

    expect(store.holds_itself()).toBe(true);
});

// A hole of an array handed stays a hole, as in the array and in Svelte's
// state: the copy wrote every index, and `forEach` and `in` found an
// `undefined` there.
test('a hole of an array handed stays a hole', () => {
    const places = [];

    places[1] = 'b';
    places[3] = 'd';
    store.rows = places;

    const visited = [];

    store.rows.forEach((one, at) => visited.push(at));

    expect([store.rows.length, visited, 0 in store.rows]).toEqual([4, [1, 3], false]);
});
