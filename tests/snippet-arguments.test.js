import { test, expect, describe } from 'vitest';
import { createRawSnippet } from 'svelte';
import { mount, unmount, flushSync } from './mounted.js';
import SnippetArgsChild from './fixtures/SnippetArgsChild.svelte';
import SnippetArgsChildNative from './fixtures/SnippetArgsChildNative.svelte';
import SnippetArgsHost from './fixtures/SnippetArgsHost.svelte';
import SnippetArgsPythonHost from './fixtures/SnippetArgsPythonHost.svelte';
import SnippetLocalWhole from './fixtures/SnippetLocalWhole.svelte';

const shown = async (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    let instance;

    try {
        instance = mount(Component, { target, props });
        flushSync();
    } catch (error) {
        return `ERROR: ${error.message}`;
    }

    const text = [...target.querySelectorAll('p')].map((one) => `${one.dataset.k}=${one.textContent}`).join(' ');

    await unmount(instance);

    return text;
};

// A Python child renders the snippet its parent gave it. The parent may be
// JavaScript, and then the snippet is handed what a JavaScript child would hand
// it: a number, an absence, a callback it can call with its own arguments.
describe('a snippet a JavaScript parent gives a Python child', () => {
    test('is handed what a Svelte child hands it', async () => {
        expect(await shown(SnippetArgsHost, { Child: SnippetArgsChild })).toBe(
            await shown(SnippetArgsHost, { Child: SnippetArgsChildNative })
        );
    });

    test('the Svelte child is the rule', async () => {
        expect(await shown(SnippetArgsHost, { Child: SnippetArgsChildNative })).toBe(
            'number=number:0.25 absence=true callback=7 ready=ready'
        );
    });
});

// A snippet this markup declares is handed Python values as they are: `1.0`
// is a float, as CPython has it, where a number made JavaScript's would come
// back an int.
test('a snippet of the same markup keeps a whole float', async () => {
    expect(await shown(SnippetLocalWhole)).toBe('own=float:1.0');
});

// A Python parent's snippet rendered by a Python child still reads Python
// values: a float, None and a callable.
test('a snippet a Python parent gives a Python child reads Python values', async () => {
    expect(await shown(SnippetArgsPythonHost)).toBe('python=float:0.5|True|7 ready=ready');
});

// `{@render footer?.()}` renders nothing when the prop is absent, however it is
// absent, as Svelte's does, and renders the snippet when one is given.
describe('an optional snippet', () => {
    const footer = createRawSnippet(() => ({ render: () => '<p data-k="footer">given</p>' }));

    test.each([
        ['omitted', {}],
        ['undefined', { footer: undefined }],
        ['null', { footer: null }],
        ['given', { footer }]
    ])('%s, as Svelte does', async (_, props) => {
        expect(await shown(SnippetArgsChild, props)).toBe(await shown(SnippetArgsChildNative, props));
    });

    test('the Svelte child is the rule', async () => {
        expect(await shown(SnippetArgsChildNative, {})).toBe('ready=ready');
        expect(await shown(SnippetArgsChildNative, { footer })).toBe('footer=given ready=ready');
    });
});
