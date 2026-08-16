import { test, expect, describe } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Lifecycle from './fidelity/Lifecycle.svelte';

// on_mount / on_destroy par convention de nom, adossés à un unique $effect :
// le corps s'exécute une fois le DOM en place, le nettoyage à la destruction.
describe('cycle de vie', () => {
    test('on_mount s’exécute après le montage', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Lifecycle, { target });
        flushSync();

        expect(target.querySelector('p[data-k="started"]').textContent).toBe('oui');
    });

    test('on_destroy s’exécute au démontage, avec l’état final', () => {
        const seen = [];
        const target = document.body.appendChild(document.createElement('div'));
        const app = mount(Lifecycle, { target, props: { notify: (msg) => seen.push(msg) } });
        flushSync();

        target.querySelector('button[data-k="tick"]').click();
        target.querySelector('button[data-k="tick"]').click();
        flushSync();
        expect(target.querySelector('p[data-k="ticks"]').textContent).toBe('2');

        expect(seen).toEqual([]);
        unmount(app);
        flushSync();

        expect(seen).toEqual(['détruit après 2 tick(s)']);
    });

    test('on_mount ne rejoue pas quand l’état change', () => {
        // Le risque réel : l'$effect lit les signaux des fonctions, et rejouerait
        // à chaque écriture s'il en suivait un qui change.
        const target = document.body.appendChild(document.createElement('div'));
        mount(Lifecycle, { target });
        flushSync();

        target.querySelector('button[data-k="tick"]').click();
        target.querySelector('button[data-k="tick"]').click();
        flushSync();

        expect(target.querySelector('p[data-k="mounts"]').textContent).toBe('1');
    });
});
