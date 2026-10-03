// A name a `def` bound first is a name of the module like any other. A decorator
// or a later line may put a list there, and its mutations repaint what reads
// it, in a store and in a component, as they do for a name `=` bound.
//
// The cell of a `def` was the one cell with no revision and no `track`: a
// reassignment showed, and an `append` did not.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import store from './fixtures/replaced_rows_store.svelte.py';
import ReplacedRowsReader from './fixtures/ReplacedRowsReader.svelte';
import ReplacedRows from './fixtures/ReplacedRows.svelte';

const mounted = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();

    return (key) => target.querySelector(`[data-k="${key}"]`).textContent;
};

test("a store's list where a def stood repaints a JavaScript reader", () => {
    const shown = mounted(ReplacedRowsReader);

    store.grow();
    flushSync();

    expect([shown('decorated'), shown('assigned')]).toEqual(['1', '1']);

    // Replaced, the new list is shown, and it is the one followed.
    store.replace();
    flushSync();

    expect(shown('decorated')).toBe('2');

    store.grow();
    flushSync();

    expect(shown('decorated')).toBe('3');
});

test("a component's list where a def stood repaints its markup", () => {
    const target = document.body.appendChild(document.createElement('div'));
    const shown = (key) => target.querySelector(`[data-k="${key}"]`).textContent;

    mount(ReplacedRows, { target });
    flushSync();
    target.querySelector('[data-k="grow"]').click();
    flushSync();

    expect([shown('decorated'), shown('assigned')]).toEqual(['1', '1']);
});
