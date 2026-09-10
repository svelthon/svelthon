import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Walrus from './fixtures/Walrus.svelte';

// `onclick={() => (open = !open)}` is the commonest line in a Svelte template
// and has no short Python twin: a `lambda` holds an expression, and `open = not
// open` is a statement. `(open := not open)` is an expression — Python's own
// answer — and its own semantics are useless here, since PEP 572 binds in the
// enclosing function and a lambda is one. A template is not plain Python, so
// here it writes the component's name.
describe('a walrus in a handler', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Walrus, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('it writes the name, and the render follows', () => {
        const { read, click } = setup();

        expect(read('open')).toBe('False');
        click('toggle');
        expect(read('open')).toBe('True');
        click('toggle');
        expect(read('open')).toBe('False');
    });

    test('it reads the name it writes', () => {
        const { read, click } = setup();

        click('plus');
        click('plus');
        expect(read('count')).toBe('2');
    });

    test('a constant target', () => {
        const { read, click } = setup();

        click('plus');
        click('reset');
        expect(read('count')).toBe('0');
    });

    test('it closes over the block variable it was written beside', () => {
        const { read, click } = setup();

        click('tab-css');
        expect(read('tab')).toBe('css');
    });

    test('two in one expression', () => {
        const { read, click } = setup();

        click('tab-js');
        click('two');
        expect(read('picked')).toBe('js');
        expect(read('count')).toBe('2');
    });
});
