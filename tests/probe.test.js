import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import Host from './fixtures/LeakHost.svelte';

test('probe', () => {
    const t = document.body.appendChild(document.createElement('div'));
    mount(Host, { target: t });
    flushSync();

    const read = () => [
        t.querySelector('[data-k="alive"]').textContent,
        t.querySelector('[data-k="subscribed"]').textContent
    ].join('/');

    const seen = [];
    for (let i = 0; i < 4; i++) {
        t.querySelector('button').click();
        flushSync();
        t.querySelector('button').click();
        flushSync();
        seen.push(read());
    }

    expect(seen).toBe('VOIR');
});
