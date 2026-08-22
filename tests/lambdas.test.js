import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Lambdas from './fixtures/Lambdas.svelte';

// `onclick={lambda: choose(pep)}` — a handler in the language the rest of the
// component is written in. Until now a directive's value stayed JavaScript, so
// this had to be written `onclick={() => choose(pep)}`: a JavaScript arrow in
// the middle of a Python component, and the one seam an author could not guess.
describe('a handler written as a lambda', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Lambdas, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            },
            press: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('it closes over the block variable it was written beside', () => {
        const { read, click } = setup();

        expect(read('picked')).toBe('none');
        click('pick-703');
        expect(read('picked')).toBe('PEP 703');
    });

    test('each row keeps its own', () => {
        const { read, click } = setup();
        click('pick-484');
        expect(read('picked')).toBe('PEP 484');
    });

    // A lambda that reads the *event* — `lambda e: on_text(e.target.value)` —
    // needs `from browser import html`, which jsdom cannot import: Brython's
    // `get_class` looks a DOM node's tag up in that module to find its Python
    // class. Covered in a real browser instead, never here.
    test('one written beside an ordinary call', () => {
        const { read, press } = setup();
        press('say');
        expect(read('typed')).toBe('said');
    });
});
