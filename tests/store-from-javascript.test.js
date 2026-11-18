import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import StoreReader from './fixtures/StoreReader.svelte';
import StoreJsReader from './fixtures/StoreJsReader.svelte';
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

// Read by JavaScript alone, an array handed is kept as it was, its own copy of
// each level made at its first read, and read and written through a proxy that
// tells of each change, as Svelte's `$state` is: nothing is made Python's until
// Python reads it, and then everything JavaScript did is there.
describe('a store only JavaScript reads', () => {
    const setup = (rows) => {
        const target = document.body.appendChild(document.createElement('div'));

        store.rows = rows;
        mount(StoreJsReader, { target });
        flushSync();

        return () => [target.querySelector('p[data-k="js"]').textContent, target.querySelector('p[data-k="first"]').textContent];
    };

    test('follows a change made through the store', () => {
        const read = setup([]);

        store.rows.push({ n: 1 });
        flushSync();
        expect(read()).toEqual(['1', '1']);

        store.rows[0].n = 2;
        flushSync();
        expect(read()).toEqual(['1', '2']);

        store.rows.splice(0, 1);
        flushSync();
        expect(read()).toEqual(['0', '-']);
    });

    // Nothing written through the store reaches what was handed, and nothing
    // changed in it afterwards reaches the store, as with `$state`.
    test('and keeps what it was handed apart', () => {
        const handed = [{ n: 1 }];
        const read = setup(handed);

        store.rows[0].n = 2;
        handed.push({ n: 3 });
        flushSync();

        expect([read(), handed[0].n, store.rows.length]).toEqual([['1', '2'], 1, 1]);
    });

    test('and reads as an array of its own, the same each time', () => {
        const handed = [1.5, new Date(0), { n: 1 }];

        setup(handed);

        expect([store.rows === store.rows, store.rows === handed, Array.isArray(store.rows), store.rows[1] === handed[1], JSON.stringify(store.rows)]).toEqual([
            true,
            false,
            true,
            true,
            '[1.5,"1970-01-01T00:00:00.000Z",{"n":1}]'
        ]);
    });

    // Python's first read makes it Python's own, everything JavaScript wrote
    // in it, and a proxy JavaScript kept writes what Python reads after.
    test('until Python reads it, a proxy kept writing what Python reads', () => {
        const read = setup(['a']);
        const kept = store.rows;

        kept.push('b');
        store.bump_rows();
        kept.push('c');
        flushSync();

        expect([[...store.rows], read()[0]]).toEqual([['a', 'b', 'python', 'c'], '4']);
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
