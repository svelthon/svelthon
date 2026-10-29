// **A CSS custom property on a Python child crosses as JavaScript**:
// `--rate={value}` is no prop of the child's, Svelte writes it into the wrapper
// it makes around the child. It crossed as a Python child's props cross, kept
// Python, and a float was written `[object Object]` into the style, by each way
// of naming the child. The prop beside it stays Python.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CssRates from './fixtures/CssRates.svelte';

const WAYS = ['direct', 'held', 'dynamic', 'snippet'];

test('a CSS custom property on a Python child is the number, by each way of naming it', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(CssRates, { target });
    flushSync();

    const read = () =>
        WAYS.map((way) => {
            const section = target.querySelector(`[data-k="${way}"]`);
            return [way, section.firstElementChild.style.getPropertyValue('--rate'), section.querySelector('output').textContent];
        });

    const first = read();
    instance.change();
    flushSync();

    expect([first, read()]).toEqual([
        WAYS.map((way) => [way, '0.5', 'Rate']),
        WAYS.map((way) => [way, '0.75', 'Rate'])
    ]);
});
