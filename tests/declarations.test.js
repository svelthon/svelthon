import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';

import Declarations from './fixtures/Declarations.svelte';

// `{x = e}` and `{y => e}`, mounted rather than read off the emitted code. They
// replace `{@const}`, which was Svelte vocabulary in a Python file, with the two
// signs the script already uses.
const page = () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    mount(Declarations, { target: host });

    return host;
};

describe('a derived declared in the markup', () => {
    test('reads the block s own name', () => {
        expect([...page().querySelectorAll('.etiquette')].map((p) => p.textContent)).toEqual([
            '10 × 10 = 100',
            '15 × 4 = 60'
        ]);
    });

    // The case Svelte's own documentation example gets wrong: their
    // `{const area = box.width * box.height}` is computed once and never again,
    // because a declaration tag without a rune is not reactive. Ours is always
    // the derived.
    test('and follows its data when the item moves', () => {
        const host = page();

        host.querySelector('button').click();
        flushSync();

        expect(host.querySelector('.etiquette').textContent).toBe('20 × 10 = 200');
    });
});

describe('state declared in the markup', () => {
    test('is read like any other name', () => {
        expect(page().querySelector('.compte').textContent).toBe('2');
    });

    // `bind:` on a markup name is handed to Svelte untouched. Compiled into the
    // read/write pair instead, the generated `def` would assign to its own
    // parameter and the write would die with the call, silently.
    test('and a bind: writes it, which upgrades it to a signal', () => {
        const host = page();
        const input = host.querySelector('input');

        expect(host.querySelector('.brouillon').textContent).toBe('ADA');

        input.value = 'grace';
        input.dispatchEvent(new Event('input'));
        flushSync();

        expect(host.querySelector('.brouillon').textContent).toBe('GRACE');
    });
});
