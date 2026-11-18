import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import StoreReader from './fixtures/StoreReader.svelte';
import { store } from './fixtures/counted.svelte.py';

// The half of a store that is not written in Python, and the line the README's
// table did not have: every one of its rows is a mutation written in Python, and
// a published store exists to be read and written from JavaScript.
//
// **Replacing the container propagates, and so does mutating it through the
// store**, as with Svelte's `$state`, which makes an array it is handed its own:
// the store keeps a JavaScript array as Python's own list, and its getter hands
// the list's view, whose `push` is Python's `append`. Kept as it was handed, the
// array was mutated around every entry point the tracking wraps, and the page
// showed nothing until Python touched the list.
describe('a store written from JavaScript', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));

        store.rows = [];
        mount(StoreReader, { target });
        flushSync();

        return () => target.querySelector('p[data-k="rows"]').textContent;
    };

    test('propagates when the container is replaced', () => {
        const read = setup();

        expect(read()).toBe('0');

        store.rows = ['a', 'b'];
        flushSync();

        expect(read()).toBe('2');
    });

    test('and when the container is mutated through the store', () => {
        const read = setup();

        store.rows.push('a');
        flushSync();
        expect(read()).toBe('1');

        store.rows[1] = 'b';
        flushSync();
        expect(read()).toBe('2');

        store.rows.splice(0, 1);
        flushSync();
        expect(read()).toBe('1');

        store.rows.length = 0;
        flushSync();
        expect(read()).toBe('0');
    });

    // What was handed is not the store's: changed afterwards, it tells nobody
    // and the store does not hold the change, as with `$state`.
    test('but not when the array handed is changed afterwards', () => {
        const read = setup();
        const handed = [];

        store.rows = handed;
        flushSync();
        handed.push('a');
        flushSync();

        expect([read(), [...store.rows]]).toEqual(['0', []]);
    });

    // A mutation from JavaScript and one from Python are of one list.
    test('and a Python mutation after it shows both', () => {
        const read = setup();

        store.rows.push('a');
        store.bump_rows();
        flushSync();

        expect(read()).toBe('2');
    });
});

// What a getter hands JavaScript crosses too: a float reads as a number, and a
// value written through the setter reads back as itself.
describe('a store read from JavaScript', () => {
    test('a float is a number', () => {
        expect(store.price).toBe(0.25);
    });

    test('and one written reads back as itself', () => {
        store.price = 0.5;

        expect(store.price).toBe(0.5);
        expect(JSON.stringify({ price: store.price })).toBe('{"price":0.5}');
    });

    test('and a derived float is a number too', () => {
        store.price = 0.5;

        expect(store.doubled).toBe(1);
    });

    // An array handed is the store's own list, read back as its view, as
    // `$state` reads back the proxy it made of one.
    test('an array written reads back as the store’s own', () => {
        const rows = ['a'];
        store.rows = rows;

        expect([store.rows === rows, Array.isArray(store.rows), [...store.rows]]).toEqual([false, true, ['a']]);
    });
});
