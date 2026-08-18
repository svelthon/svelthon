import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Effects from './fixtures/Effects.svelte';

// @effect rejoue le corps quand un nom qu'il a *lu* change. Rien à déclarer :
// les globals passent par les accesseurs du namespace, donc leurs lectures sont
// des lectures de signaux, et Svelte en déduit les dépendances.
//
// Piège propre à ce modèle : `runs += 1` sur un nom de niveau module **lit**
// avant d'écrire, donc un compteur incrémenté dans un effet le rend dépendant
// de ce qu'il écrit — et Svelte boucle. Une affectation simple ne lit rien.
describe('@effect', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Effects, { target });
        flushSync();
        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('le corps s’exécute au montage', () => {
        const { read } = setup();

        expect(read('seen')).toBe('count=0');
        expect(read('torn')).toBe('-'); // rien à démonter encore
    });

    test('il rejoue quand une dépendance change', () => {
        const { read, click } = setup();

        click('bump');
        expect(read('seen')).toBe('count=1');
    });

    test('la fonction rendue sert de nettoyage, avant chaque reprise', () => {
        const { read, click } = setup();

        click('bump');
        expect(read('torn')).toBe('torn at 0'); // fermé sur la valeur précédente
    });

    test('il ne rejoue pas pour un nom qu’il ne lit pas', () => {
        const { read, click } = setup();

        click('other');
        expect(read('seen')).toBe('count=0');
        expect(read('torn')).toBe('-');
        expect(read('other')).toBe('1'); // le nom a bien changé
    });
});
