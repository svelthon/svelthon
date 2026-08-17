import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import Counter from './Counter.svelte';

test('a click runs Python and the DOM follows', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Counter, { target });

    const button = target.querySelector('button');
    expect(button.textContent).toBe('clicked 0 times');

    button.click();
    flushSync();
    expect(button.textContent).toBe('clicked 1 times');

    button.click();
    button.click();
    flushSync();
    expect(button.textContent).toBe('clicked 3 times');
});
