import { test, expect, describe } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Lifecycle from './fixtures/Lifecycle.svelte';

// on_mount / on_destroy by naming convention, backed by a single $effect: the
// body runs once the DOM is in place, the cleanup when the component goes away.
describe('lifecycle', () => {
    test('on_mount runs after mounting', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Lifecycle, { target });
        flushSync();

        expect(target.querySelector('p[data-k="started"]').textContent).toBe('yes');
    });

    test('on_destroy runs on unmount, with the final state', () => {
        const seen = [];
        const target = document.body.appendChild(document.createElement('div'));
        const app = mount(Lifecycle, { target, props: { notify: (msg) => seen.push(msg) } });
        flushSync();

        target.querySelector('button[data-k="tick"]').click();
        target.querySelector('button[data-k="tick"]').click();
        flushSync();
        expect(target.querySelector('p[data-k="ticks"]').textContent).toBe('2');

        expect(seen).toEqual([]);
        unmount(app);
        flushSync();

        expect(seen).toEqual(['destroyed after 2 tick(s)']);
    });

    test('on_mount does not replay when state changes', () => {
        // The real risk: the $effect reads the functions' signals, and would
        // replay on every write if it tracked one that changes.
        const target = document.body.appendChild(document.createElement('div'));
        mount(Lifecycle, { target });
        flushSync();

        target.querySelector('button[data-k="tick"]').click();
        target.querySelector('button[data-k="tick"]').click();
        flushSync();

        expect(target.querySelector('p[data-k="mounts"]').textContent).toBe('1');
    });
});
