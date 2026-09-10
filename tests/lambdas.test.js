import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
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
            type: (k, value) => {
                const input = target.querySelector(`input[data-k="${k}"]`);

                input.value = value;
                input.dispatchEvent(new window.Event('input', { bubbles: true }));
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

    // The other shape: a lambda that takes the event and walks it. Brython's
    // `get_class` gives `e.target` its Python class from `browser.html`, so this
    // is also the check that the module is there without anyone importing it.
    test('one that reads the event it is given', () => {
        const { read, type } = setup();

        type('text', 'hello');
        expect(read('typed')).toBe('hello');
    });
});
