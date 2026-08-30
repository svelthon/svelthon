import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import C from './fixtures/CustomTransition.svelte';

test('probe', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(C, { target });
    flushSync();
    target.querySelector('button').click();
    flushSync();
    await new Promise((r) => setTimeout(r, 400));
    flushSync();
    expect(target.querySelector('[data-k="calls"]').textContent).toBe('VOIR');
});
