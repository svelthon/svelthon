import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import W from './fixtures/WalrusCall.svelte';

test('p', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(W, { target });
    flushSync();
    target.querySelector('button').click();
    flushSync();

    expect(['a', 'b'].map((k) => `${k}=${target.querySelector(`[data-k="${k}"]`).textContent}`)).toBe('X');
});
