import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CartReader from './fixtures/CartReader.svelte';
import { store, kept } from './fixtures/cart.svelte.py';

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

// Written back as JavaScript read it, a `<select>` bound to the store choosing
// it again, the instance was replaced by its view: Python then held a
// `JSObject`, no longer its `Cart`.
test('an instance a store hands JavaScript is itself again when written back', () => {
    const before = store.cart;
    store.cart = store.cart;

    expect(kept(before)).toBe(true);
});
