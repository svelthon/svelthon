// What Svelte 5 does, a Python component does by delegating to it: special
// elements, boundaries, keyed blocks, snippets, transitions, bindings. And a
// boundary catches a Python exception as Python: `failed` and `onerror` see
// the exception's type and message, and `reset` mounts the child again once
// the cause is gone.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SvelteConstructs from './fixtures/SvelteConstructs.svelte';
import BoundaryHandler from './fixtures/BoundaryHandler.svelte';

describe('the everyday constructs of Svelte 5', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(SvelteConstructs, { target });
        flushSync();
        return {
            q: (selector) => target.querySelector(selector),
            all: (selector) => [...target.querySelectorAll(selector)].map((node) => node.textContent)
        };
    };

    test('<svelte:element> makes the tag it is given', () => {
        expect(setup().q('.dyn').tagName).toBe('ARTICLE');
    });

    test('<svelte:boundary> renders what it holds', () => {
        expect(setup().q('.inside').textContent).toBe('inside');
    });

    test('a keyed {#each} with an index', () => {
        expect(setup().all('.row')).toEqual(['0:a', '1:b']);
    });

    test('children and a named snippet with an argument', () => {
        const { q } = setup();

        expect(q('.child').textContent).toBe('child');
        expect(q('.foot').textContent).toBe('end');
    });

    test('a transition given its parameters as a dict', () => {
        expect(setup().q('.faded').textContent).toBe('faded');
    });

    test('a bound textarea', () => {
        expect(setup().q('.ta').value).toBe('hello');
    });

    test('braces written literally in a <pre>', () => {
        expect(setup().q('.pre').textContent).toBe('{braces}');
    });

    test('<svelte:window> hands its events to Python', () => {
        const { q } = setup();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        flushSync();

        expect(q('.keys').textContent).toBe('1');
    });

    // Brython names a node's class after its tag.
    test('bind:this hands Python the node', () => {
        expect(setup().q('.el').textContent).toBe('DIV');
    });
});

describe('a boundary around a Python child that raises', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(BoundaryHandler, { target });
        flushSync();
        return (selector) => target.querySelector(selector);
    };

    test('shows the Python exception in its failed snippet', () => {
        // CPython's wording since 3.12, which Brython follows.
        expect(setup()('.failed').textContent).toBe('ZeroDivisionError: division by zero');
    });

    test('hands it to an onerror written in Python, as a Python object', () => {
        expect(setup()('.caught').textContent).toBe("['ZeroDivisionError']");
    });

    test('and mounts the child again on reset, once the cause is fixed', () => {
        const q = setup();

        q('.fix').click();
        flushSync();
        q('.reset').click();
        flushSync();

        expect(q('.quotient').textContent).toBe('5');
        expect(q('.failed')).toBeNull();
    });
});
