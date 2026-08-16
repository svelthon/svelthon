import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Derived from './fidelity/Derived.svelte';

// @derived transforme une fonction en valeur : Python lit le nom et obtient le
// résultat, comme une @property. Le corps s'exécute dans $derived.by, et chaque
// global qu'il touche passe par un accesseur du namespace — Svelte découvre donc
// les dépendances tout seul, sans qu'on les déclare.
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

    test('la valeur est calculée à la lecture', () => {
        const { read } = setup();
        expect(read('full')).toBe('Ada Lovelace');
    });

    test('elle se recalcule quand une dépendance change', () => {
        const { read, rename } = setup();

        expect(read('full')).toBe('Ada Lovelace');
        rename();
        expect(read('full')).toBe('Grace Lovelace');
    });

    test('un @derived peut en lire un autre, par son nom', () => {
        const { read, rename } = setup();

        expect(read('shouted')).toBe('ADA LOVELACE');
        rename();
        expect(read('shouted')).toBe('GRACE LOVELACE');
    });
});
