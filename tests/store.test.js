import { test, expect, beforeEach } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import StoreA from './fixtures/StoreA.svelte';
import StoreB from './fixtures/StoreB.svelte';
import StoreFromPython from './fixtures/StoreFromPython.svelte';
import { store } from '../src/counter_store.svelte.py';

// A store's state outliving a test is the feature this file is about, so a test
// that opens on an absolute value is asserting the order it happens to run in:
// shuffled, the first read below was `A:2:[1, 2]`. Each test says where it
// starts instead, through the store's own `reset`.
beforeEach(() => {
    store.reset();
    flushSync();
});

// A store is Python at module level: its signals exist once for the whole
// application, where a component's state is born and dies with every instance.
test('Python state shared between two components', () => {
    const t = document.body.appendChild(document.createElement('div'));
    mount(StoreA, { target: t });
    mount(StoreB, { target: t });
    const read = (k) => t.querySelector(`p[data-k="${k}"]`).textContent;
    const click = (k) => { t.querySelector(`button[data-k="${k}"]`).click(); flushSync(); };

    expect(read('a')).toBe('A:0:[]');
    expect(read('b')).toBe('B:0:');

    click('inc');
    click('inc');
    expect(read('a')).toBe('A:2:[1, 2]');
    expect(read('b')).toBe('B:2:1,2');   // the other component follows

    click('reset');
    expect(read('a')).toBe('A:0:[]');
    expect(read('b')).toBe('B:0:');
});

test('a store’s state survives unmounting', () => {
    const t = document.body.appendChild(document.createElement('div'));
    const first = mount(StoreA, { target: t });
    t.querySelector('button[data-k="inc"]').click();
    flushSync();
    expect(t.querySelector('p[data-k="a"]').textContent).toBe('A:1:[1]');

    unmount(first);
    flushSync();

    const second = document.body.appendChild(document.createElement('div'));
    mount(StoreA, { target: second });
    expect(second.querySelector('p[data-k="a"]').textContent).toBe('A:1:[1]');

    mount(StoreB, { target: second });
    second.querySelector('button[data-k="reset"]').click();
    flushSync();
});

// The bridge in the other direction: a component's Python imports the store and
// reaches the very same signals as the template.
test('a component’s Python imports the store', () => {
    const t = document.body.appendChild(document.createElement('div'));
    mount(StoreB, { target: t });
    mount(StoreFromPython, { target: t });

    t.querySelector('button[data-k="reset"]').click();
    flushSync();
    expect(t.querySelector('p[data-k="b"]').textContent).toBe('B:0:');

    t.querySelector('button[data-k="bump"]').click();
    flushSync();

    expect(t.querySelector('p[data-k="seen"]').textContent).toBe('2'); // read from Python
    expect(t.querySelector('p[data-k="b"]').textContent).toBe('B:2:1,2');  // seen by the other component
});
