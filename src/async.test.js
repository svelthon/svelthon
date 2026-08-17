import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Async from './fidelity/Async.svelte';

// Calling an `async def` from JavaScript returns a coroutine nobody runs — the
// handler would appear to do nothing at all. Brython has its own event loop, so
// the wrapper hands it over. (`async def` is also a distinct AST node, and
// missing it left async handlers undefined in the first place.)
describe('async def', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Async, { target });
        flushSync();
        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            },
            settle: async () => {
                await new Promise((resolve) => setTimeout(resolve, 60));
                flushSync();
            }
        };
    };

    test('un handler asynchrone s’exécute', async () => {
        const { read, click, settle } = setup();

        expect(read('plain')).toBe('no');
        click('go-plain');
        await settle();
        expect(read('plain')).toBe('yes');
    });

    test('await rend la main puis reprend', async () => {
        const { read, click, settle } = setup();

        click('go-awaited');
        flushSync();
        expect(read('awaited')).toBe('no'); // suspendu sur await

        await settle();
        expect(read('awaited')).toBe('yes');
        expect(read('order')).toBe("['before', 'after']");
    });
});
