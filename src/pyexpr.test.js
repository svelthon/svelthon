import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import PyExpr from './fidelity/PyExpr.svelte';

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
