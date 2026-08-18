import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import Counter from './Counter.svelte';

test('a click runs Python and the DOM follows', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Counter, { target });

    const button = target.querySelector('button');
    const value = () => target.querySelector('output').textContent;

    expect(value()).toBe('0');

    button.click();
    flushSync();
    expect(value()).toBe('1');

    button.click();
    button.click();
    flushSync();
    expect(value()).toBe('3');
});
