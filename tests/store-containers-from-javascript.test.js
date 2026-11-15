// What a store holds in a container reached JavaScript as the engine keeps it:
// `store.todos[0].title` was undefined, `String(store.todos[1])` gave
// `[object Object]`, `toggle()` was no function, and a set, bytes and a range
// had neither size, length nor iteration. It crosses as a `.py` module hands
// it over, the list or the dict the page follows and an instance in it read
// through its view.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TodosReader from './fixtures/TodosReader.svelte';
import { store } from './fixtures/todos.svelte.py';

test('an instance a store holds in a list or a dict reads, calls and is followed from JavaScript', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(TodosReader, { target });
    flushSync();

    expect(target.querySelector('p').textContent).toBe('2 a false Todo b x');

    target.querySelector('button').click();
    flushSync();

    expect(target.querySelector('p').textContent).toBe('3 a true Todo b x');
});

test('a set, bytes and a range a store holds read as JavaScript reads them', () => {
    expect([store.tags instanceof Set, store.tags.size]).toEqual([true, 2]);
    expect([store.raw instanceof Uint8Array, store.raw.length]).toEqual([true, 2]);
    expect([Array.isArray(store.span), [...store.span]]).toEqual([true, [0, 1, 2]]);
});
