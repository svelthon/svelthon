import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';

import JsAttrs from './fixtures/JsAttrs.svelte';
import PyAttrs from './fixtures/PyAttrs.svelte';

// Ce fichier ne vérifie pas ce que SVELTHON fait, mais qu'il fait *la même chose*
// que Svelte. Les deux composants sont mot pour mot les mêmes, l'un en Python
// avec un dict et une liste mutés en place, l'autre en JavaScript avec un $state
// proxifié en profondeur. Toute ligne qui divergerait ici est un bug — sauf à
// être une divergence choisie, et alors elle se documente.

const render = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    return {
        el: (k) => target.querySelector(`[data-k="${k}"]`),
        mutate: () => {
            target.querySelector('button').click();
            flushSync();
        }
    };
};

describe.each([
    ['JavaScript', JsAttrs],
    ['Python', PyAttrs]
])('mutation en place, attributs — %s', (_language, Component) => {
    test('un étalement propage', () => {
        const { el, mutate } = render(Component);

        expect(el('spread').getAttribute('data-n')).toBe('0');
        mutate();
        expect(el('spread').getAttribute('data-n')).toBe('1');
    });

    test('un attribut dont la valeur est calculée propage', () => {
        const { el, mutate } = render(Component);

        expect(el('attr').getAttribute('title')).toBe('a');
        mutate();
        expect(el('attr').getAttribute('title')).toBe('a,b');
    });

    test('un attribut portant le conteneur lui-même ne propage pas', () => {
        const { el, mutate } = render(Component);

        // Ni ici ni en JavaScript : Svelte compare la valeur à celle qu'il a
        // écrite la fois d'avant, par identité, et un conteneur muté est le même
        // objet. Ce n'est pas une limite de SVELTHON, c'est la sémantique de
        // l'hôte — et ce test est là pour le prouver des deux côtés.
        expect(el('raw').getAttribute('title')).toBe('a');
        mutate();
        expect(el('raw').getAttribute('title')).toBe('a');
    });
});
