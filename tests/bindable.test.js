import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import BindHost from './fixtures/BindHost.svelte';

// Une annotation dont la valeur est un appel à bindable() déclare un prop
// bidirectionnel :  value: str = bindable()   /   tag: str = bindable("default")
//
// Le piège : le corps du module applique le défaut en écrivant dans le nom, et
// cette écriture-là ne doit pas remonter au parent. Seules celles qui suivent
// init() sont de vraies écritures.
describe('bindable', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(BindHost, { target });
        flushSync();
        return {
            read: (sel) => target.querySelector(sel).textContent,
            click: (sel) => {
                target.querySelector(sel).click();
                flushSync();
            }
        };
    };

    test('la valeur du parent descend', () => {
        const { read } = setup();

        expect(read('[data-k="parent"]')).toBe('hello');
        expect(read('[data-k="bound"] [data-k="value"]')).toBe('hello');
    });

    test('une écriture Python de l’enfant remonte au parent', () => {
        const { read, click } = setup();

        click('[data-k="bound"] button');
        expect(read('[data-k="parent"]')).toBe('HELLO');
    });

    test('une écriture du parent redescend', () => {
        const { read, click } = setup();

        click('button[data-k="reset"]');
        expect(read('[data-k="bound"] [data-k="value"]')).toBe('reset');
    });

    test('le défaut s’applique sans écraser le parent', () => {
        const { read } = setup();

        // Le défaut vaut pour les deux instances : le parent ne lie que `value`.
        expect(read('[data-k="unbound"] [data-k="tag"]')).toBe('default');
        expect(read('[data-k="bound"] [data-k="tag"]')).toBe('default');
    });

    test('une instance non liée reste indépendante', () => {
        const { read, click } = setup();

        click('[data-k="bound"] button');
        // Un prop non fourni vaut None, comme un prop ordinaire — les
        // expressions du gabarit étant du Python, il se rend « None ».
        expect(read('[data-k="unbound"] [data-k="value"]')).toBe('None');
    });
});
