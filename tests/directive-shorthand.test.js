// `class:active` is Svelte's `class:active={active}`, and `style:color` its
// `style:color={color}`. Left unexpanded, Svelte read the raw cell with
// JavaScript's truth, so Python's None and `[]`, both objects, set the class,
// and `style:color` with None wrote an empty `style` attribute. Expanded where
// `bind:name` is, the short spelling renders what the long one renders, as it
// does in Svelte.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DirectiveShorthand from './fixtures/DirectiveShorthand.svelte';
import DirectiveShorthandNative from './fixtures/DirectiveShorthandNative.svelte';

const mounted = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    const read = () =>
        Object.fromEntries(
            [...target.querySelectorAll('p')].map((one) => [
                one.dataset.k,
                `${[...one.classList].filter((name) => !name.startsWith('svelte-')).join(' ')}|${one.getAttribute('style')}`
            ])
        );
    const click = () => {
        target.querySelector('button').click();
        flushSync();
    };

    return { read, click };
};

// Each short spelling against its long one, on the same page.
const pairs = (rows) =>
    Object.keys(rows)
        .filter((key) => key.endsWith('-short'))
        .map((key) => [rows[key], rows[key.replace('-short', '-long')]]);

test.for([['before', false], ['after a change', true]])(
    'a short class: or style: renders as its long spelling, %s, as in Svelte',
    ([, change]) => {
        const ours = mounted(DirectiveShorthand);
        const theirs = mounted(DirectiveShorthandNative);

        if (change) {
            ours.click();
            theirs.click();
        }

        for (const [short, long] of pairs(theirs.read())) expect(short).toBe(long);
        for (const [short, long] of pairs(ours.read())) expect(short).toBe(long);
    }
);

test('and reads Python’s truth', () => {
    const rows = mounted(DirectiveShorthand).read();

    expect(rows['none-short']).toBe('|null');
    expect(rows['empty-short']).toBe('|null');
    expect(rows['on-short']).toBe('on|null');
});
