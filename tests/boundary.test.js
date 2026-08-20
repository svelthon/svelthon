import { test, expect, describe } from 'vitest';
import { mount } from 'svelte';
import JsBoundary from './fixtures/JsBoundary.svelte';

// Une fonction Python confiée à du JavaScript — le rappel d'un `query()`, d'un
// `command()`, de n'importe quelle fonction nommée dans `__js__` ou importée par
// le `<script module>`. JavaScript appelle avec ce qu'il a ; Python refuse un
// argument positionnel qu'il n'a pas déclaré. La frontière est là pour que
// l'auteur n'ait rien à écrire : `query(accepted)` en Python doit se lire comme
// `query(accepted)` en TypeScript.
describe('frontière vers JavaScript', () => {
    const render = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(JsBoundary, { target });
        return (key) => target.querySelector(`p[data-k="${key}"]`).textContent;
    };

    test('un rappel Python survit à un appel JavaScript trop large', () => {
        // twice() passe deux arguments, double() n'en déclare qu'un. Sans
        // ajustement : TypeError, et la page entière échoue.
        expect(render()('total')).toBe('30');
    });

    test('*args reçoit tout ce que JavaScript envoie', () => {
        // L'inverse du cas précédent : rien à rogner, la signature avale tout.
        expect(render()('etoile')).toBe('a-b-c');
    });

    test('un conteneur Python arrive en données JavaScript', () => {
        // Sans conversion, JSON.stringify verrait les internes symboliques d'un
        // dict Brython — ou rien du tout.
        expect(render()('charge')).toBe('{"a":[1,2],"b":null}');
    });

    test('le nom garde son identité d’une lecture à l’autre', () => {
        // Envelopper à chaque lecture rendrait `f is f` faux, ce qui n'a pas de
        // sens en Python.
        expect(render()('identite')).toBe('oui');
    });

    test('to_python est défini dans un composant', () => {
        // Il était lié à un `pyArg` que le script du composant n'importait pas :
        // une ReferenceError à la première lecture, et seulement à celle-là.
        expect(render()('to_python')).toBe('oui');
    });
});
