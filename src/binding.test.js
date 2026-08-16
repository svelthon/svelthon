import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Bound from './fidelity/Bound.svelte';

// Un nom d'état est un `let` réactif ordinaire, donc `bind:` fonctionne sans que
// SVELTHON ait à s'en mêler : Svelte écrit dans le signal, Python le relit par
// l'accesseur du namespace. (Un *prop* est un $derived, donc en lecture seule —
// c'est déjà la règle de Svelte pour les props non `$bindable`.)
describe('bind:', () => {
    const setup = () => {
        const t = document.body.appendChild(document.createElement('div'));
        mount(Bound, { target: t });
        return {
            input: t.querySelector('input[data-k="text"]'),
            echo: () => t.querySelector('p[data-k="echo"]').textContent,
            shout: () => {
                t.querySelector('button[data-k="shout"]').click();
                flushSync();
            }
        };
    };

    test('la valeur initiale vient de Python', () => {
        const { input, echo } = setup();
        expect(input.value).toBe('ada');
        expect(echo()).toBe('ada/0');
    });

    test('la saisie remonte jusqu’à Python', () => {
        const { input, echo, shout } = setup();

        input.value = 'grace';
        input.dispatchEvent(new window.Event('input', { bubbles: true }));
        flushSync();
        expect(echo()).toBe('grace/0');

        shout(); // name.upper() en Python, sur la valeur saisie
        expect(echo()).toBe('GRACE/0');
    });

    test('une écriture Python redescend dans le champ', () => {
        const { input, shout } = setup();

        shout();
        expect(input.value).toBe('ADA');
    });
});
