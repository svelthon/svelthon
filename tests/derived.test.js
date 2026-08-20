import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Derived from './fixtures/Derived.svelte';

// @derived turns a function into a value: Python reads the name and gets the
// result, like a @property. The body runs inside $derived.by, and every global
// it touches goes through a namespace accessor — so Svelte discovers the
// dependencies by itself, with nothing declared.
describe('@derived', () => {
    const setup = () => {
        const t = document.body.appendChild(document.createElement('div'));
        mount(Derived, { target: t });
        return {
            read: (k) => t.querySelector(`p[data-k="${k}"]`).textContent,
            rename: () => {
                t.querySelector('button[data-k="rename"]').click();
                flushSync();
            }
        };
    };

    test('the value is computed on read', () => {
        const { read } = setup();
        expect(read('full')).toBe('Ada Lovelace');
    });

    test('it recomputes when a dependency changes', () => {
        const { read, rename } = setup();

        expect(read('full')).toBe('Ada Lovelace');
        rename();
        expect(read('full')).toBe('Grace Lovelace');
    });

    test('a @derived can read another one, by name', () => {
        const { read, rename } = setup();

        expect(read('shouted')).toBe('ADA LOVELACE');
        rename();
        expect(read('shouted')).toBe('GRACE LOVELACE');
    });
});
