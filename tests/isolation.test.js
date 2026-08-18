import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Isolated from './fixtures/Isolated.svelte';

// Le corps du module Python est ré-exécuté pour chaque instance, et chaque nom
// reçoit son propre signal. Rien ne doit fuir d'une instance à l'autre — y
// compris les valeurs mutables créées à l'initialisation.
describe('isolation entre instances', () => {
    const mountOne = (tag) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Isolated, { target, props: { tag } });
        return {
            read: () => target.querySelector('p[data-k="state"]').textContent,
            bump: () => {
                target.querySelector('button[data-k="bump"]').click();
                flushSync();
            }
        };
    };

    test('deux instances ne partagent ni état ni défaut mutable', () => {
        const a = mountOne('a');
        const b = mountOne('b');

        expect(a.read()).toBe('a:0:[]');
        expect(b.read()).toBe('b:0:[]');

        a.bump();
        a.bump();

        expect(a.read()).toBe('a:2:[1, 2]');
        expect(b.read()).toBe('b:0:[]'); // intacte

        b.bump();

        expect(a.read()).toBe('a:2:[1, 2]');
        expect(b.read()).toBe('b:1:[1]');
    });
});
