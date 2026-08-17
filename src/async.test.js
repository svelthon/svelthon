import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Async from './fidelity/Async.svelte';
import AsyncError from './fidelity/AsyncError.svelte';

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

// Brython exécute les coroutines par sa propre boucle, dont le gestionnaire
// d'erreur par défaut se contente de journaliser : une exception levée dans une
// coroutine n'atteignait donc rien du tout. On la relève depuis un timer, ce qui
// en fait une vraie erreur non capturée — visible en devtools et dans l'overlay.
describe('erreur dans une coroutine', () => {
    test('elle remonte, nommée et située', async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(AsyncError, { target });
        flushSync();

        // jsdom ne route pas vers window.error ce qu'un timer lève : on
        // intercepte le timer pour observer le vrai chemin.
        const original = globalThis.setTimeout;
        const pending = [];
        globalThis.setTimeout = (fn, ...rest) =>
            typeof fn === 'function' && rest.length === 0 ? pending.push(fn) : original(fn, ...rest);

        try {
            target.querySelector('button[data-k="boom"]').click();
            await new Promise((resolve) => original(resolve, 80));
        } finally {
            globalThis.setTimeout = original;
        }

        expect(pending).toHaveLength(1);
        expect(pending[0]).toThrow(
            /ValueError: cassé dans la coroutine \(boom\(\) — src\/fidelity\/AsyncError\.svelte/
        );
    });

    test('une coroutine qui aboutit ne déclenche rien', async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(AsyncError, { target });
        flushSync();

        target.querySelector('button[data-k="fine"]').click();
        await new Promise((resolve) => setTimeout(resolve, 80));
        flushSync();

        expect(target.querySelector('p[data-k="state"]').textContent).toBe('ok');
    });
});
