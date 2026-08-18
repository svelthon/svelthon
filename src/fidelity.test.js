import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';

import Integers from './fidelity/Integers.svelte';
import Text from './fidelity/Text.svelte';
import Protocols from './fidelity/Protocols.svelte';
import Flow from './fidelity/Flow.svelte';
import Frames from './fidelity/Frames.svelte';
import Mutations from './fidelity/Mutations.svelte';
import Template from './fidelity/Template.svelte';
import Events from './fidelity/Events.svelte';
import Composition from './fidelity/Composition.svelte';
import Keyed from './fidelity/Keyed.svelte';
import Errors from './fidelity/Errors.svelte';
import InitError from './fidelity/InitError.svelte';
import OffsetError from './fidelity/OffsetError.svelte';

// Grille de fidélité sémantique.
//
// Chaque valeur attendue a été produite par CPython 3.12 en exécutant le code
// Python du composant tel quel (`python3 fichier.py`) — jamais écrite à la main.
// Un codegen qui optimise trop casse ces lignes avant tout le reste : supprimer
// les frames tue `Frames`, déballer les entiers tue `Integers`, court-circuiter
// `augm_assign` tue `Protocols`.

function render(Component) {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    return target;
}

function report(Component) {
    const text = render(Component).querySelector('pre').textContent;
    return Object.fromEntries(
        text.split('\n').map((line) => {
            const cut = line.indexOf('=');
            return [line.slice(0, cut), line.slice(cut + 1)];
        })
    );
}

describe('entiers — canari du déballage', () => {
    test('précision arbitraire et division euclidienne', () => {
        expect(report(Integers)).toEqual({
            big: '1180591620717411303424',
            mul: '9223372037000250000',
            floor: '-4',
            mod: '1',
            dm: '(-4, 1)',
            tdiv: '3.5',
            shift: '1267650600228229401496703205376',
            negpow: '-8',
            inexact: '0.30000000000000004'
        });
    });
});

describe('texte — canari de la représentation des chaînes', () => {
    test('unicode, tranches et mini-langage de format', () => {
        expect(report(Text)).toEqual({
            emoji_len: '1',
            emoji_ord: '128512',
            rev: "'édcba'",
            last: "'l'",
            prec: "'3.14'",
            pad: "'   42'",
            sign: "'+7'",
            sharp: "'STRASSE'",
            joined: "'abricot, banane, pomme'",
            mult: "'ababab'"
        });
    });
});

describe('protocoles — canari des raccourcis de dispatch', () => {
    test('opérateurs, descripteurs et slots', () => {
        expect(report(Protocols)).toEqual({
            inplace: 'Acc(21)',
            plain: 'Acc(3)',
            radd: "'radd(1)'",
            prop: '42',
            fallback: "'missing:nope'",
            length: '3',
            item: '8',
            slots: "'AttributeError'"
        });
    });
});

describe('flot de contrôle', () => {
    test('générateurs, fermetures, finally et chaînage d’exceptions', () => {
        const { leaked, leaked_in_func, ...rest } = report(Flow);

        expect(rest).toEqual({
            squares: '[0, 1, 4, 9]',
            genexp: '30',
            late: '[2, 2, 2]',
            nl: '2',
            ret: "'ret'",
            flow: "'try,finally'",
            cause: "'ZeroDivisionError'"
        });
    });

    // Divergence Brython connue, pas une régression de SVELTHON : la variable
    // d'une compréhension fuit dans la portée module, alors que Python 3 lui
    // donne une portée propre. Ce test passe *parce qu'il échoue* ; le jour où
    // Brython corrige, vitest le signalera.
    test.fails('la variable de compréhension ne doit pas fuir, au niveau module', () => {
        expect(report(Flow).leaked).toBe('False');
    });

    // Elle fuit aussi dans une fonction — la compréhension a sa propre portée
    // depuis Python 3.0. Vérifié contre CPython 3.12 (voir BRYTHON.md).
    test.fails('ni dans une fonction', () => {
        expect(report(Flow).leaked_in_func).toBe('False');
    });
});

describe('frames — canari de la suppression des cadres d’appel', () => {
    test('introspection et profondeur de traceback', () => {
        expect(report(Frames)).toEqual({
            name: "'own_name'",
            caller: "'outer'",
            delta: '1',
            depth: '4',
            msg: "'deep'"
        });
    });
});

// Dans un gabarit Svelte on est en JavaScript, pas en Python — et les deux
// langages ne sont pas d'accord. JS tient tout objet pour vrai, donc `{#if}` sur
// une liste vide, un dict vide ou None dirait vrai là où Python dit faux. Le
// préprocesseur réécrit les conditions vers le bool() de Python.
describe('gabarit — frontière Python/JavaScript', () => {
    const cell = (k) => render(Template).querySelector(`[data-k="${k}"]`).textContent;

    test('les valeurs vides sont fausses comme en Python', () => {
        expect(cell('empty')).toBe('faux'); // []
        expect(cell('empty_dict')).toBe('faux'); // {}
        expect(cell('none')).toBe('faux'); // None
        expect(cell('zero')).toBe('faux'); // 0
        expect(cell('text')).toBe('faux'); // ""
        expect(cell('items')).toBe('vrai'); // ["a", "b", "c"]
    });

    test('la réécriture tient sur {:else if} et les {#if} imbriqués', () => {
        expect(cell('elseif')).toBe('b');
        expect(cell('nested')).toBe('y');
    });

    test('{#each} itère nativement sur une liste Python', () => {
        expect(cell('each')).toBe('abc');
    });

    test('py.str() rend les valeurs à la façon de Python', () => {
        expect(cell('str_list')).toBe("['a', 'b', 'c']"); // JS dirait "a,b,c"
        expect(cell('str_dict')).toBe("{'x': 1}"); // JS dirait "[object Object]"
    });

    // Le préprocesseur enveloppe les interpolations de *texte* dans py.str().
    test('une interpolation nue rend déjà à la façon de Python', () => {
        expect(cell('raw_list')).toBe("['a', 'b', 'c']");
        expect(cell('raw_dict')).toBe("{'x': 1}");
        expect(cell('raw_none')).toBe('None');
    });

    test('la réécriture survit aux accolades et aux chevrons', () => {
        expect(cell('brace')).toBe('a}b'); // '}' dans une chaîne, pas une fermeture
        expect(cell('gt')).toBe('dans une balise'); // '>' dans un attribut cité
    });

    test('une valeur d’attribut garde la valeur, pas son rendu', () => {
        const el = render(Template).querySelector('[data-k="attr"]');
        expect(el.dataset.v).toBe('a,b,c'); // non enveloppé : c'est la liste elle-même
    });
});

describe('composition — objets Python et composants enfants', () => {
    const cell = (k) => render(Composition).querySelector(`[data-k="${k}"]`).textContent;

    test('dicts et tuples traversent le gabarit sans aide', () => {
        expect(cell('dict')).toBe('[x|9]'); // clés exposées comme propriétés JS
        expect(cell('tuple')).toBe('[k=1]'); // un tuple est un tableau JS
    });

    test('les attributs d’une instance se lisent depuis le gabarit', () => {
        // Brython garde les attributs hors des propriétés JS : en JavaScript,
        // {o.label} rendrait du vide. L'expression est compilée en Python, donc
        // elle passe par la recherche d'attributs de Python.
        expect(cell('obj')).toBe('[a:1][b:2]');
    });

    test('et le protocole des descripteurs est respecté', () => {
        expect(cell('prop')).toBe('[2][4]'); // une @property, pas un attribut
    });

    test('un objet Python se passe en prop à un composant enfant', () => {
        expect(cell('child')).toBe('>a=1>b=2'); // prefix laissé à son défaut
        expect(cell('child_prop')).toBe('-a=1-b=2');
    });
});

// `{#each}` avec clé est le cas où l'identité des objets Python compte
// vraiment : la copie que fait publish() ne doit pas casser la réconciliation.
describe('{#each} avec clé', () => {
    const setup = () => {
        const target = render(Keyed);
        return {
            list: () =>
                [...target.querySelectorAll('li')]
                    .map((n) => `${n.dataset.id}:${n.textContent}`)
                    .join(','),
            node: (id) => target.querySelector(`li[data-id="${id}"]`),
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('insertion et suppression réconcilient sur la clé Python', () => {
        const { list, node, click } = setup();
        const kept = node(2);

        expect(list()).toBe('1:a,2:b');

        click('prepend');
        expect(list()).toBe('3:c,1:a,2:b');
        expect(node(2)).toBe(kept); // nœud réutilisé, pas recréé

        click('drop_first');
        expect(list()).toBe('1:a,2:b');
        expect(node(2)).toBe(kept);
    });

    test('muter un attribut d’un élément ne re-rend pas', () => {
        const { list, click } = setup();

        click('relabel'); // it.label = it.label.upper() + publish("items")
        expect(list()).toBe('1:a,2:b'); // inchangé : l'élément a la même identité
    });

    test('remplacer l’élément re-rend, et garde le nœud', () => {
        const { list, node, click } = setup();
        const kept = node(2);

        click('replace'); // items[i] = Item(it.id, ...)
        expect(list()).toBe('1:a,2:B');
        expect(node(2)).toBe(kept); // la clé n'a pas changé
    });
});

// Une exception Brython arrive en JavaScript sans `message` ni `stack` : les
// devtools et l'overlay de Vite n'afficheraient rien. Le texte existe pourtant,
// dans l'objet Python, là où rien de JS ne va le chercher.
describe('erreurs Python', () => {
    test('une exception non rattrapée est lisible côté JavaScript', () => {
        const target = render(Errors);
        let captured = null;
        window.addEventListener('error', (ev) => (captured = ev), { once: true });

        target.querySelector('button[data-k="boom"]').click();
        flushSync();

        expect(captured).not.toBeNull();
        // La ligne vient de la traceback Python, recalée sur le fichier.
        expect(captured.error.message).toBe(
            'ValueError: cassé au fond (boom() — src/fidelity/Errors.svelte:6)'
        );
        expect(captured.error.stack).toContain('boom() — src/fidelity/Errors.svelte:6');
    });

    test('le composant survit à une exception', () => {
        const target = render(Errors);
        window.addEventListener('error', () => {}, { once: true });

        target.querySelector('button[data-k="boom"]').click();
        flushSync();
        target.querySelector('button[data-k="works"]').click();
        flushSync();

        expect(target.querySelector('p[data-k="count"]').textContent).toBe('1');
    });

    test('un try/except Python reste un try/except Python', () => {
        const target = render(Errors);

        target.querySelector('button[data-k="caught"]').click();
        flushSync();

        expect(target.querySelector('p[data-k="message"]').textContent).toBe(
            'ValueError: cassé au fond'
        );
    });

    test('la ligne reste juste quand un autre script précède le Python', () => {
        const target = render(OffsetError);
        let captured = null;
        window.addEventListener('error', (ev) => (captured = ev), { once: true });

        target.querySelector('button[data-k="boom"]').click();
        flushSync();

        expect(captured.error.message).toBe(
            "KeyError: 'décalé' (boom() — src/fidelity/OffsetError.svelte:11)"
        );
    });

    test('une erreur dans le corps du module nomme le fichier', () => {
        expect(() => render(InitError)).toThrow(/ZeroDivisionError.*InitError\.svelte/);
    });
});

describe('événements — la frontière avec le DOM', () => {
    test('une valeur extraite dans le gabarit arrive en Python', () => {
        const target = render(Events);
        const input = target.querySelector('input');

        input.value = 'bonjour';
        input.dispatchEvent(new window.Event('input', { bubbles: true })); // Svelte délègue
        flushSync();

        expect(target.querySelector('p[data-k="typed"]').textContent).toBe('BONJOUR');
    });

    test('un handler qui déclare un paramètre reçoit l’événement emballé', () => {
        const target = render(Events);

        target.querySelector('button').click();
        flushSync();

        expect(target.querySelector('p[data-k="kind"]').textContent).toBe('DOMEvent');
    });
});

// Ce bloc ne teste pas Python mais SVELTHON lui-même : quelles écritures Python
// déclenchent un rendu. Un signal par nom de module ⇒ c'est le *rebinding* d'un
// nom qui est réactif, jamais la mutation en place d'une valeur.
describe('réactivité — quelles écritures Python propagent', () => {
    const setup = () => {
        const target = render(Mutations);
        const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;
        const click = (k) => {
            target.querySelector(`button[data-k="${k}"]`).click();
            flushSync();
        };
        return { read, click };
    };

    test('réaffecter un nom propage', () => {
        const { read, click } = setup();

        expect(read('count')).toBe('0');
        click('rebind');
        expect(read('count')).toBe('1');
        click('augment'); // `global count; count += 10` est aussi une réaffectation
        expect(read('count')).toBe('11');
    });

    test('réaffecter une liste propage', () => {
        const { read, click } = setup();

        const before = read('items');
        click('rebind_list');
        expect(read('items')).not.toBe(before);
    });

    test('muter en place ne propage pas — limitation assumée', () => {
        const { read, click } = setup();

        const before = read('items');
        click('mutate_only');
        expect(read('items')).toBe(before);

        click('attribute_only');
        expect(read('depth')).toBe('0');
    });

    // publish(nom) rend au gabarit une identité neuve après une mutation en
    // place, sans que le composant entretienne une valeur publiée en parallèle.
    test('publish() rattache une liste mutée', () => {
        const { read, click } = setup();

        const before = read('items');
        click('mutate_then_publish');
        expect(read('items')).not.toBe(before);
    });

    test('publish() rattache un dict muté', () => {
        const { read, click } = setup();

        expect(read('table')).toBe('{}');
        click('dict_then_publish');
        expect(read('table')).toBe("{'k': 0}");
    });

    test('muter puis publier propage', () => {
        const { read, click } = setup();

        click('mutate_and_publish');
        expect(read('size')).toBe('1');

        click('attribute_and_publish');
        expect(read('depth')).toBe('1');
    });
});
