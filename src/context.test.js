import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import CtxHost from './fidelity/CtxHost.svelte';

// Le contexte est par sous-arbre, là où un store est par application : deux
// instances du même composant peuvent en porter des valeurs différentes. C'est
// aussi le seul endroit sûr pour de l'état en rendu serveur par requête, puisque
// l'arbre de composants est recréé à chaque rendu.
describe('contexte', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(CtxHost, { target });
        flushSync();
        return (k) => target.querySelector(`[data-k="${k}"] [data-k="leaf"]`).textContent;
    };

    test('un descendant lit ce qu’un ancêtre a posé', () => {
        // CtxMiddle sépare les deux et ne connaît rien du contexte.
        expect(setup()('a')).toBe('dark/None');
    });

    test('deux sous-arbres portent des valeurs indépendantes', () => {
        const leaf = setup();

        expect(leaf('a')).toBe('dark/None');
        expect(leaf('b')).toBe('light/None');
    });

    test('une clé absente vaut None, pas undefined', () => {
        expect(setup()('a').split('/')[1]).toBe('None');
    });
});
