// The surface Svelte documents, put to Svelthon one construct at a time. The
// other test files each defend a feature; this one asks the flat question the
// project's goal implies — what of Svelte is there, and what is not.
//
// Compiling is not rendering, so each of these is mounted. The two that are only
// compiled here are named in AUDIT4.md with the reason.
import { test, expect, describe, vi } from 'vitest';
import { mount, flushSync } from 'svelte';
import Shorthand from './fixtures/SvShorthand.svelte';
import Options from './fixtures/SvOptions.svelte';
import Element from './fixtures/SvElement.svelte';
import Window from './fixtures/SvWindow.svelte';
import Head from './fixtures/SvHead.svelte';
import Boundary from './fixtures/SvBoundary.svelte';
import BoundaryCatch from './fixtures/SvBoundaryCatch.svelte';
import KeyBlock from './fixtures/SvKeyBlock.svelte';
import EachElse from './fixtures/SvEachElse.svelte';
import Snippet from './fixtures/SvSnippet.svelte';
import StyleDir from './fixtures/SvStyleDir.svelte';
import ClassArray from './fixtures/SvClassArray.svelte';
import UseParams from './fixtures/SvUseParams.svelte';
import BindThis from './fixtures/SvBindThis.svelte';

const render = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    return {
        at: (k) => target.querySelector(`[data-k="${k}"]`),
        html: () => target.innerHTML,
        click: () => {
            target.querySelector('button').click();
            flushSync();
        }
    };
};

describe('the special elements', () => {
    // `this` is an expression, so the tag itself is chosen in Python.
    test('<svelte:element> takes its tag from a name', () =>
        expect(render(Element).html()).toContain('<h2>dynamic</h2>'));

    test('<svelte:window> binds a browser value back into Python', () =>
        expect(render(Window).at('width').textContent).toBe('True'));

    test('<svelte:head> renders its children outside the component', () =>
        expect(render(Head).at('head').textContent).toBe('ok'));

    test('<svelte:options> is read at compile time and does not disturb the rest', () =>
        expect(render(Options).at('name').textContent).toBe('x'));

    test('<svelte:boundary> renders its children when nothing fails', () =>
        expect(render(Boundary).at('boundary').textContent).toBe('safe'));

    // The one that matters: an exception raised in Python has to be caught by a
    // JavaScript error boundary, and its `failed` snippet shown instead.
    test('and catches a Python exception, showing its failed snippet', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { at } = render(BoundaryCatch);
        spy.mockRestore();

        expect(at('failed').textContent).toBe('caught');
        expect(at('body')).toBeNull();
    });
});

describe('the blocks and their clauses', () => {
    test('{#key} rebuilds its content when the key changes', () => {
        const { at, click } = render(KeyBlock);

        expect(at('key').textContent).toBe('1');
        click();
        expect(at('key').textContent).toBe('2');
    });

    test('{#each} falls to its else branch on an empty list', () =>
        expect(render(EachElse).at('else').textContent).toBe('none'));

    test('{#snippet} is declared once and rendered per row', () =>
        expect(render(Snippet).html()).toContain('<li data-k="row">20</li>'));
});

describe('the directives that are not bind: or on:', () => {
    test('style: writes one property, in Python', () =>
        expect(render(StyleDir).at('style').getAttribute('style')).toBe('color: rgb(1, 2, 3);'));

    test('a class array joins its truthy members', () =>
        expect(render(ClassArray).at('class').className).toBe('one two'));

    test('use: hands its parameters to the action as a dict', () =>
        expect(render(UseParams).at('use').dataset.mark).toBe('yes'));

    test('bind:this gives Python the element itself', () =>
        expect(render(BindThis).at('this').textContent).toBe('section'));

    // `{onclick}` takes the shorthand path rather than the handler path, so the
    // Python function is handed to Svelte unwrapped. A Brython function is
    // callable from JavaScript, so it runs.
    test('an event handler passed by shorthand still fires', () => {
        const { at, click } = render(Shorthand);

        expect(at('seen').textContent).toBe('0');
        click();
        expect(at('seen').textContent).toBe('1');
    });
});
