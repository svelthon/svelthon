import { test, expect, describe, beforeEach } from 'vitest';
import { mount, flushSync } from 'svelte';

import PyBlocks from './fidelity/PyBlocks.svelte';

// Les expressions du gabarit sont du Python — y compris aux quatre endroits qui
// n'étaient pas des interpolations : ce que l'on itère, ce qui sert de clé, ce
// qu'un {@const} vaut, et ce qu'un {@html} rend.

let target;
const el = (k) => target.querySelector(`[data-k="${k}"]`);
const text = (k) => [...el(k).children].map((c) => c.textContent).join('|');

beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
    mount(PyBlocks, { target });
    flushSync();
});

describe("l'itérable d'un {#each} est Python", () => {
    // Une liste et un tuple sont littéralement des tableaux JavaScript, donc ils
    // marchaient déjà. Tout le reste ne marchait pas.
    test('un dict donne ses clés, dans son ordre', () => {
        expect(text('dict')).toBe('b|a');
    });

    test('.items() donne des paires, déstructurées par le bloc', () => {
        expect(text('items')).toBe('b=2|a=1');
    });

    test('un range', () => {
        expect(text('range')).toBe('0|1|2');
    });

    test('un générateur', () => {
        expect(text('gen')).toBe('0|1|4|9');
    });

    test('et la clé du bloc reste évaluée dedans', () => {
        expect(text('keyed')).toBe('b2|a1');
    });
});

test('le membre droit d\'un {@const} a la sémantique Python', () => {
    // JavaScript rendrait -3.5 : la division entière de Python arrondit vers le
    // bas, et c'est elle qui doit s'appliquer dans un gabarit Python.
    expect(text('const')).toBe('-4|-3');
});

test('{@html} évalue du Python', () => {
    // len() n'existe pas en JavaScript : si l'expression y était restée, la
    // compilation du composant aurait échoué.
    expect(el('html').innerHTML).toBe('<b>2</b>');
});

describe('{#key} compare par valeur', () => {
    test('une valeur égale ne recrée pas le bloc', () => {
        const before = el('keyblock');
        el('rebuild').click();
        flushSync();

        // Le tuple est un objet neuf — donc un tableau JavaScript neuf, que
        // Svelte jugerait différent. C'est repr() qui les rapproche.
        expect(el('keyblock')).toBe(before);
    });

    test('une valeur différente le recrée', () => {
        const before = el('keyblock');
        el('change').click();
        flushSync();

        expect(el('keyblock')).not.toBe(before);
    });
});
