import { test, expect, describe } from 'vitest';
import { hydrate, flushSync } from 'svelte';
import Counter from './Counter.svelte';

// Le troisième mode du runner de Svelte, après client et serveur : le HTML vient
// du serveur, et le client s'y raccroche au lieu de tout reconstruire. C'est là
// que les deux rendus doivent s'accorder — et le corps Python s'exécute des deux
// côtés.
//
// La chaîne ci-dessous est exactement ce que produit render() ; src/ssr.test.js
// l'affirme, pour que les deux ne puissent pas diverger en silence.
const SERVER_HTML = '<!--[--><button>increment()</button> <output>0</output><!--]-->';

function serverRendered(html = SERVER_HTML) {
    const target = document.body.appendChild(document.createElement('div'));
    target.innerHTML = html;
    return target;
}

describe('hydratation', () => {
    test('les nœuds du serveur sont réutilisés, pas reconstruits', () => {
        const target = serverRendered();
        const button = target.querySelector('button');
        const output = target.querySelector('output');

        hydrate(Counter, { target });
        flushSync();

        // La preuve que l'hydratation a eu lieu : l'identité des nœuds survit.
        expect(target.querySelector('button')).toBe(button);
        expect(target.querySelector('output')).toBe(output);
    });

    test('le Python est branché sur les nœuds repris', () => {
        const target = serverRendered();

        hydrate(Counter, { target });
        flushSync();

        target.querySelector('button').click();
        flushSync();

        expect(target.querySelector('output').textContent).toBe('1');
    });

    test('en cas de divergence, le client l’emporte — en silence', () => {
        // Le cas d'un composant non déterministe : l'heure, un aléa, une session.
        const target = serverRendered(
            '<!--[--><button>increment()</button> <output>7</output><!--]-->'
        );
        const warnings = [];
        const original = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));

        try {
            hydrate(Counter, { target });
            flushSync();
        } finally {
            console.warn = original;
        }

        expect(target.querySelector('output').textContent).toBe('0');
        expect(warnings).toEqual([]); // rien n'avertit : la page clignote, c'est tout
    });
});
