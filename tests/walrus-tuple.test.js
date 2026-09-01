import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import WalrusTuple from './fixtures/WalrusTuple.svelte';

// Svelte has two inline ways to assign twice in a handler — the comma operator
// and a block body — and a Python lambda holds no statements, so the tuple of
// walruses is the only Svelthon equivalent of either. It used to keep the first
// assignment and drop the rest, silently.
describe('a tuple of walruses in a handler', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(WalrusTuple, { target });
        flushSync();

        return {
            read: () =>
                ['a', 'b', 'c']
                    .map((k) => target.querySelector(`p[data-k="${k}"]`).textContent)
                    .join(','),
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('assigns both names', () => {
        const { read, click } = setup();

        expect(read()).toBe('0,0,0');
        click('two');
        expect(read()).toBe('1,2,0');
    });

    test('and all three', () => {
        const { read, click } = setup();

        click('three');
        expect(read()).toBe('7,8,9');
    });
});
