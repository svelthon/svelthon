import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import PyExpr from './fixtures/PyExpr.svelte';
import Shorthand from './fixtures/Shorthand.svelte';
import JsImport from './fixtures/JsImport.svelte';

// Les expressions du gabarit sont compilées en Python, pas laissées au parseur
// JavaScript. Chaque site devient une fonction Python cachée que le balisage
// appelle, les variables de bloc passées en argument — donc les dépendances se
// découvrent seules, comme pour @derived.
describe('expressions Python dans le gabarit', () => {
    const cell = (k) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(PyExpr, { target });
        flushSync();
        return target.querySelector(`[data-k="${k}"]`).textContent;
    };

    test('les opérateurs Python', () => {
        expect(cell('is')).toBe('True'); // `is None`, pas `=== null`
        expect(cell('and')).toBe('True'); // `and`, pas `&&`
        expect(cell('not')).toBe('False'); // `not`, pas `!`
        expect(cell('ternary')).toBe('oui'); // `a if c else b`
    });

    test('les builtins et la syntaxe de séquence', () => {
        expect(cell('len')).toBe('3'); // len(), pas .length
        expect(cell('slice')).toBe("['b', 'c']"); // tranche Python
        expect(cell('subscript')).toBe('1'); // dict par clé
        expect(cell('comprehension')).toBe("['A', 'B', 'C']");
    });

    test('les f-strings', () => {
        expect(cell('fstring')).toBe('3 éléments');
    });

    test('les attributs d’instance, sans py.of()', () => {
        // C'était la verrue principale : Brython garde les attributs hors des
        // propriétés JS, donc `{r.label}` ne rendait rien.
        expect(cell('attr')).toBe('[x:X][y:Y]');
    });

    test('les conditions suivent la vérité de Python', () => {
        expect(cell('if')).toBe('faux'); // None est faux, une liste pleine est vraie
    });
});

// Un composant Python n'importe pas de JavaScript — mais son `<script module>`,
// lui, le fait, et ces noms sont dans la portée du code généré. Les publier dans
// le namespace est ce qui laisse Python atteindre `page` de $app/state, ou
// n'importe quelle bibliothèque npm.
describe('les imports du <script module> se lisent depuis Python', () => {
    const el = (k) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(JsImport, { target });
        flushSync();
        return target.querySelector(`[data-k="${k}"]`).textContent;
    };

    test('une constante déclarée là-bas', () => {
        expect(el('direct')).toBe('venu du JavaScript');
    });

    test('et elle traverse un @derived', () => {
        expect(el('derive')).toBe('VENU DU JAVASCRIPT');
    });

    test('une fonction importée', () => {
        expect(el('fonction')).toBe('oui');
    });

    test('un import étoilé', () => {
        expect(el('etoile')).toBe('oui');
    });
});
