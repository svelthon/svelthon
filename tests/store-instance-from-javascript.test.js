import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CartReader from './fixtures/CartReader.svelte';

// An instance a store holds reached JavaScript as the object the engine keeps,
// whose only key is its type: `store.cart.size` was undefined, `String()` gave
// `[object Object]`, and a click on a button calling its method did nothing.
// It crosses as it does from a function of the store, or as a prop: as its
// attributes, its properties, its methods and its `__str__`, and the page
// follows what a method called from JavaScript changes.
test('an instance a store holds reads, calls and is followed from JavaScript', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(CartReader, { target });
    flushSync();

    expect(target.querySelector('p').textContent).toBe('cart 0 0 Cart of 0');

    target.querySelector('button').click();
    flushSync();

    expect(target.querySelector('p').textContent).toBe('cart 1 1 Cart of 1');
});
