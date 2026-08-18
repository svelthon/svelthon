// @vitest-environment node
//
// Rendu côté serveur : Svelte compile une seconde version du composant qui rend
// une chaîne HTML au lieu de créer des nœuds DOM. Le corps Python s'exécute donc
// sous Node — ce que le compilateur fait déjà au build, à deux shims près
// (`self`, `addEventListener`) posés par src/lib/globals.js.
import { test, expect, describe } from 'vitest';
import { render } from 'svelte/server';

import Counter from './Counter.svelte';
import Greeting from './Greeting.svelte';
import Semantics from './Semantics.svelte';
import StoreDemo from './StoreDemo.svelte';
import Composition from './fixtures/Composition.svelte';
import CtxHost from './fixtures/CtxHost.svelte';
import { store } from '../src/lib/counter_store.py';

// Svelte parsème le HTML de marqueurs d'hydratation ; seul le texte nous importe.
const text = (result) => result.body.replace(/<!--[^>]*-->/g, '');

describe('rendu serveur', () => {
    test('un composant Python rend du HTML sans DOM', () => {
        expect(text(render(Counter))).toBe('<button>increment()</button> <output>0</output>');
    });

    // src/hydration.test.js repart de cette chaîne exacte, marqueurs compris :
    // l'affirmer ici interdit aux deux fichiers de diverger en silence.
    test('les marqueurs d’hydratation sont ceux attendus par le client', () => {
        expect(render(Counter).body).toBe(
            '<!--[--><button>increment()</button> <output>0</output><!--]-->'
        );
    });

    test('les props sont résolues côté serveur', () => {
        expect(text(render(Greeting, { props: { name: 'Ada' } }))).toContain('Hello Ada!');
    });

    test('les valeurs Python sont calculées, pas approximées', () => {
        // Le même canari que côté client : ces trois valeurs seraient fausses en JS.
        const html = text(render(Semantics));

        expect(html).toContain('-4');
        expect(html).toContain('1180591620717411303424');
        expect(html).toContain('apple, pear');
    });

    test('la composition et les attributs d’instance traversent aussi', () => {
        const html = text(render(Composition));

        expect(html).toContain('[a:1][b:2]'); // attributs d'instance
        expect(html).toContain('[2][4]'); // @property évaluée
        expect(html).toContain('<li>>a=1</li>'); // composant enfant
    });

    // Le contexte, lui, vit dans l'arbre de composants — recréé à chaque rendu,
    // donc sans fuite d'une requête à l'autre. C'est la réponse de Svelte au
    // problème ci-dessous.
    test('le contexte reste propre à chaque rendu', () => {
        const first = text(render(CtxHost));
        const second = text(render(CtxHost));

        expect(first).toContain('dark/None');
        expect(first).toContain('light/None');
        expect(second).toBe(first);
    });

    // Le piège du rendu serveur, et il n'est pas propre à SVELTHON : l'état d'un
    // module vit dans le processus, donc il est partagé par toutes les requêtes.
    // Svelte pose exactement le même avertissement pour un `$state` de niveau
    // module dans un `.svelte.js`. Sans danger au prérendu — une seule passe,
    // aucun utilisateur concurrent —, à proscrire en rendu par requête.
    test('l’état d’un store persiste d’un rendu au suivant', () => {
        expect(text(render(StoreDemo))).toContain('0 · []');

        store.increment();

        expect(text(render(StoreDemo))).toContain('1 · [1]');
    });
});
