import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import AwaitCoroutine from './fixtures/AwaitCoroutine.svelte';

// An `{#await}` over a promise works and is covered elsewhere. This is the case
// a Python author reaches for first: an `async def` in the component, awaited by
// the template.
//
// It rendered `undefined` until the runtime's `schedule()` started handing back
// a promise. It ran the coroutine and returned nothing, so the block awaited
// `undefined` and resolved to it immediately — the wrapper that *does* return a
// promise was wired only to the export boundaries.
describe('an await block over a coroutine', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(AwaitCoroutine, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            settle: async () => {
                await new Promise((resolve) => setTimeout(resolve, 120));
                flushSync();
            }
        };
    };

    test('the pending branch shows first', () => {
        expect(setup().read('block')).toBe('waiting');
    });

    test('the then branch gets the value the coroutine returned', async () => {
        const { read, settle } = setup();
        await settle();
        expect(read('block')).toBe('42');
    });

    test('a coroutine that raises lands in the catch branch', async () => {
        const { read, settle } = setup();
        await settle();
        expect(read('failing')).toContain('no answer');
    });
});
