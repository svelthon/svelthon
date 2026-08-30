import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import W from './fixtures/WalrusCall.svelte';

test('p', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(W, { target });
    flushSync();

    let thrown = null;
    try {
        target.querySelector('button').click();
        flushSync();
    } catch (e) {
        thrown = e.message.slice(0, 80);
    }

    expect({ thrown, saved: target.querySelector('[data-k="saved"]').textContent }).toBe('X');
});
