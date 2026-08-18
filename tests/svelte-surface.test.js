import { test, expect, describe } from 'vitest';
import { mount, flushSync, tick } from 'svelte';

import SvBlocks from './fixtures/SvBlocks.svelte';
import SvBindings from './fixtures/SvBindings.svelte';
import SvDirectives from './fixtures/SvDirectives.svelte';
import SvShell from './fixtures/SvShell.svelte';

// Quelle part de Svelte fonctionne dans un composant Python ? Ce fichier répond
// par des faits plutôt que par des suppositions. Les fonctionnalités qui ne
// touchent ni à l'état ni au balisage passent d'office ; celles qui traversent
// la frontière Python/JS sont les seules intéressantes, et elles sont ici.

function render(Component) {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();
    return target;
}

describe('blocs et directives de gabarit', () => {
    const el = (k) => render(SvBlocks).querySelector(`[data-k="${k}"]`);

    test('{@html} passe la chaîne telle quelle', () => {
        expect(el('html').innerHTML).toBe('<b>gras</b>');
    });

    test('{@const} dans un {#each}', () => {
        expect(el('const').textContent).toBe('[a!][b!]');
    });

    test('{#key}', () => {
        expect(el('key').textContent).toBe('k3');
    });

    test('class: et style: lisent des noms Python', () => {
        expect(el('classdir').className).toBe('on');
        expect(el('styledir').getAttribute('style')).toBe('color: red;');
    });

    test('{#each} indexé et {:else}', () => {
        expect(el('eachidx').textContent).toBe('[0:a][1:b]');
        expect(el('eachelse').textContent).toBe('vide');
    });
});

describe('liaisons et snippets', () => {
    test('bind:checked dans les deux sens', () => {
        const t = render(SvBindings);
        const box = t.querySelector('[data-k="chk"]');

        expect(box.checked).toBe(true); // valeur initiale venue de Python
        expect(t.querySelector('[data-k="chkv"]').textContent).toBe('True');

        box.click();
        flushSync();
        expect(t.querySelector('[data-k="chkv"]').textContent).toBe('False');
    });

    test('bind:group', () => {
        const t = render(SvBindings);
        expect(t.querySelector('[data-k="radio"]').checked).toBe(false); // pick vaut "b"
        expect(t.querySelector('[data-k="pick"]').textContent).toBe('b');
    });

    test('bind:this écrit le nœud dans un nom Python', () => {
        // Un nœud DOM brut n'est pas un objet Python tant que browser.html n'est
        // pas importé — comme event.target. On l'observe donc sans opération
        // Python : le rendu se replie sur la conversion JavaScript.
        expect(render(SvBindings).querySelector('[data-k="thisv"]').textContent).toContain(
            'HTMLParagraph'
        );
    });

    test('un composant Python reçoit et rend ses enfants', () => {
        // {#snippet children()} côté parent, {@render children()} côté enfant.
        expect(render(SvBindings).querySelector('[data-k="card"]').innerHTML).toContain(
            '<h3>Bonjour</h3><em>contenu</em>'
        );
    });
});

describe('directives et éléments spéciaux', () => {
    test('{#await}, use:, bind sur <svelte:window>, style scopé, spread', async () => {
        const t = render(SvDirectives);
        await tick();
        await Promise.resolve();
        flushSync();

        expect(t.querySelector('[data-k="await"]').textContent).toBe('résolu');
        expect(t.querySelector('[data-k="action"]').getAttribute('data-action')).toBe('ok');
        expect(t.querySelector('[data-k="width"]').textContent).toBe('1024'); // écrit par Svelte
        expect(t.querySelector('[data-k="scoped"]').className).toMatch(/^svelte-/);

        // {...props} où props est un dict Python : ses clés sont des propriétés JS.
        expect(t.querySelector('[data-k="card"]').innerHTML).toContain('<h3>étalé</h3>');
    });

    test('transition:, <svelte:head>, <svelte:boundary>', () => {
        const t = render(SvShell);

        expect(t.querySelector('[data-k="fade"]')).not.toBeNull();
        expect(document.title).toBe('titre');
        expect(t.querySelector('[data-k="inside"]')).not.toBeNull();
    });
});
