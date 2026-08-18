import { test, expect, describe, beforeEach } from 'vitest';
import { mount, flushSync } from 'svelte';

import Revision from './fidelity/Revision.svelte';

// Spike : une mutation en place peut-elle se propager par un signal de révision
// séparé, plutôt qu'en réaffectant une copie comme le fait publish() ?

let target;
const el = (k) => target.querySelector(`[data-k="${k}"]`);
const rows = (k) => el(k).children.length;

beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
    mount(Revision, { target });
    flushSync();
});

describe('propagation par compteur de révision', () => {
    test('un {#each} voit la mutation', () => {
        expect(rows('each')).toBe(2);
        el('mutate').click();
        flushSync();
        expect(rows('each')).toBe(3);
    });

    test('une interpolation la voit', () => {
        el('mutate').click();
        flushSync();
        expect(el('len').textContent).toBe('3');
    });

    test('un $derived qui calcule la voit', () => {
        expect(el('total').textContent).toBe('3');
        el('mutate').click();
        flushSync();
        expect(el('total').textContent).toBe('6'); // 1 + 2 + 3
    });

    test('un $derived qui rend le même objet la voit aussi', () => {
        expect(rows('derived')).toBe(2);
        el('mutate').click();
        flushSync();
        expect(rows('derived')).toBe(3);
    });

    test('témoin : sans le compteur, rien ne bouge', () => {
        el('silently').click();
        flushSync();
        expect(rows('each')).toBe(2);
    });
});
