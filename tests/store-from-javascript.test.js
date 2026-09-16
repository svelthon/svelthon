import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import StoreReader from './fixtures/StoreReader.svelte';
import { store } from './fixtures/counted.svelte.py';

// The half of a store that is not written in Python, and the line the README's
// table did not have: every one of its rows is a mutation written in Python, and
// a published store exists to be read and written from JavaScript.
//
// **Replacing the container propagates. Mutating it does not.** The tracking
// wraps Brython's own entry points — `call_attr`, `$setitem`, `$delitem` — and
// `Array.prototype.push` called from JavaScript goes around all three. Making it
// notify would need a proxy on the value the getter hands out, on the hottest
// path the engine has; the honest answer is to say so, and to hold the line with
// this test rather than leave it to be discovered.
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

    test('and does not when the container is mutated', () => {
        const read = setup();

        store.rows.push('a');
        flushSync();

        // The store has it; the page does not, until Python touches the list.
        expect([...store.rows]).toHaveLength(1);
        expect(read()).toBe('0');
    });

    // What makes the silence liveable: the next Python mutation catches up, and
    // it catches up to the true value rather than to a stale one.
    test('while Python catching up shows everything at once', () => {
        const read = setup();

        store.rows.push('a');
        store.bump_rows();
        flushSync();

        expect(read()).toBe('2');
    });
});
