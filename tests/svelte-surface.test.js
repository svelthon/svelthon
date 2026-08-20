import { test, expect, describe } from 'vitest';
import { mount, flushSync, tick } from 'svelte';

import SvBlocks from './fixtures/SvBlocks.svelte';
import SvBindings from './fixtures/SvBindings.svelte';
import SvDirectives from './fixtures/SvDirectives.svelte';
import SvShell from './fixtures/SvShell.svelte';

// How much of Svelte works inside a Python component? This file answers with
// facts rather than guesses. Features that touch neither state nor markup pass
// by construction; the ones that cross the Python/JS boundary are the only
// interesting ones, and they are here.

function render(Component) {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();
    return target;
}

describe('template blocks and directives', () => {
    const el = (k) => render(SvBlocks).querySelector(`[data-k="${k}"]`);

    test('{@html} passes the string through as it is', () => {
        expect(el('html').innerHTML).toBe('<b>bold</b>');
    });

    test('{@const} inside an {#each}', () => {
        expect(el('const').textContent).toBe('[a!][b!]');
    });

    test('{#key}', () => {
        expect(el('key').textContent).toBe('k3');
    });

    test('class: and style: read Python names', () => {
        expect(el('classdir').className).toBe('on');
        expect(el('styledir').getAttribute('style')).toBe('color: red;');
    });

    test('indexed {#each} and {:else}', () => {
        expect(el('eachidx').textContent).toBe('[0:a][1:b]');
        expect(el('eachelse').textContent).toBe('empty');
    });
});

describe('bindings and snippets', () => {
    test('bind:checked both ways', () => {
        const t = render(SvBindings);
        const box = t.querySelector('[data-k="chk"]');

        expect(box.checked).toBe(true); // initial value out of Python
        expect(t.querySelector('[data-k="chkv"]').textContent).toBe('True');

        box.click();
        flushSync();
        expect(t.querySelector('[data-k="chkv"]').textContent).toBe('False');
    });

    test('bind:group', () => {
        const t = render(SvBindings);
        expect(t.querySelector('[data-k="radio"]').checked).toBe(false); // pick is "b"
        expect(t.querySelector('[data-k="pick"]').textContent).toBe('b');
    });

    test('bind:this writes the node into a Python name', () => {
        // A raw DOM node is not a Python object until browser.html is imported
        // — like event.target. So we observe it with no Python operation: the
        // rendering falls back to the JavaScript conversion.
        expect(render(SvBindings).querySelector('[data-k="thisv"]').textContent).toContain(
            'HTMLParagraph'
        );
    });

    test('a Python component receives and renders its children', () => {
        // {#snippet children()} on the parent, {@render children()} on the child.
        expect(render(SvBindings).querySelector('[data-k="card"]').innerHTML).toContain(
            '<h3>Hello</h3><em>content</em>'
        );
    });
});

describe('directives and special elements', () => {
    test('{#await}, use:, bind on <svelte:window>, scoped style, spread', async () => {
        const t = render(SvDirectives);
        await tick();
        await Promise.resolve();
        flushSync();

        expect(t.querySelector('[data-k="await"]').textContent).toBe('resolved');
        expect(t.querySelector('[data-k="action"]').getAttribute('data-action')).toBe('ok');
        expect(t.querySelector('[data-k="width"]').textContent).toBe('1024'); // written by Svelte
        expect(t.querySelector('[data-k="scoped"]').className).toMatch(/^svelte-/);

        // {...props} where props is a Python dict: its keys are JS properties.
        expect(t.querySelector('[data-k="card"]').innerHTML).toContain('<h3>spread</h3>');
    });

    test('transition:, <svelte:head>, <svelte:boundary>', () => {
        const t = render(SvShell);

        expect(t.querySelector('[data-k="fade"]')).not.toBeNull();
        expect(document.title).toBe('title');
        expect(t.querySelector('[data-k="inside"]')).not.toBeNull();
    });
});
