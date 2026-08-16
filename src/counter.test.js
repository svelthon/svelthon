import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import Counter from './Counter.svelte';

test('un clic exécute du Python et le DOM suit', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Counter, { target });

    const button = target.querySelector('button');
    expect(button.textContent).toBe('compté 0 fois');

    button.click();
    flushSync();
    expect(button.textContent).toBe('compté 1 fois');

    button.click();
    button.click();
    flushSync();
    expect(button.textContent).toBe('compté 3 fois');
});
