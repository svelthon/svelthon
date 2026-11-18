// The integration probe: one component carrying every recent repair at once,
// run three ways — mounted, rendered on the server, and hydrated on its own
// server output.
//
// Why this exists, and why it is worth a file of its own: a unit test writes the
// smallest component that exercises one thing, and the smallest component is the
// one where nothing meets anything. An author's file is large. Every defect this
// instrument found was a pair of repairs that each held alone.
//
// The three runs are not the same question. The client run is the one the other
// tests already ask. The server run has no DOM, so a rule that reached for one
// shows here. Hydration is the only place the two have to **agree**, and a
// mismatch there is silent in production: Svelte keeps the server's nodes and
// the page stops following the model.
import { test, expect, describe } from 'vitest';
import { hydrate, flushSync } from 'svelte';
import { mount } from './mounted.js';
import Together from './fixtures/Together.svelte';
import { SERVER_HTML } from './fixtures/together-html.js';

// Everything the page says, in one string, so a divergence between two runs is
// one comparison rather than fifteen.
const shown = (root) =>
    [...root.querySelectorAll('[data-k]')]
        .map((one) => `${one.dataset.k}=${one.textContent}`)
        .join(' | ');

describe('every repair, in one component', () => {
    test('mounted, the page and the model agree', () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(Together, { target });
        flushSync();

        const read = (k) => target.querySelector(`[data-k="${k}"]`).textContent;
        const press = (k) => {
            target.querySelector(`[data-k="${k}"]`).click();
            flushSync();
        };

        // The module block: a commented-out import declared nothing, and one
        // declaration bound two names.
        expect(read('titre')).toBe('ensemble · 3');

        // An accented alias for a name the author imported, which collides with
        // an injected helper: theirs wins.
        expect(read('apporté')).toBe('day 3');

        // A walrus in a handler, writing through the namespace.
        press('morse');
        expect(read('compte')).toBe('2');

        // A group value built from text around an interpolation. It is chosen
        // while it reads `item-0`, then the name underneath changes.
        press('radio');
        expect(read('choix')).toBe('item-0');

        press('avancer');
        expect(target.querySelector('[data-k="radio"]').value).toBe('item-1');
        // Svelte's own binding unfills a radio whose value moved under it.
        expect(target.querySelector('[data-k="radio"]').checked).toBe(false);

        press('radio');
        expect(read('choix')).toBe('item-1');

        // A braced value keeps its type: an int, not its spelling.
        press('nombre');
        expect(instance.état()).toContain('|3|');

        // A checkbox group holds a Python list.
        press('case');
        expect(read('cochés')).toBe("['c-1']");

        // The effect replayed when the name it reads changed, and its teardown
        // — a bound method, which `typeof === 'function'` used to drop — ran
        // once before the replay.
        expect(read('ouvertures')).toBe('ouvert:1');
        expect(instance.état().endsWith('|1')).toBe(true);

        // A keyed `{#each}` over accented names, a snippet, a template rune.
        expect(read('élève-0')).toBe('Ada');
        expect(read('résumé')).toBe('ensemble en hôte');
        expect(read('marge')).toBe('6');

        // `to_json` of a dict with an accented key.
        expect(JSON.parse(read('json'))).toEqual({ rôle: 'hôte', limite: 3 });
    });

    test('hydrated on its own server output, nothing is rebuilt', () => {
        const target = document.body.appendChild(document.createElement('div'));

        target.innerHTML = SERVER_HTML;

        const before = shown(target);
        const nodes = ['titre', 'compte', 'radio', 'élève-0', 'résumé'].map((k) =>
            target.querySelector(`[data-k="${k}"]`)
        );

        hydrate(Together, { target });
        flushSync();

        // The proof that hydration happened rather than a rebuild: every one of
        // the server's nodes is still the one on the page, across an element, a
        // keyed `{#each}` row and a snippet.
        for (const [at, node] of nodes.entries()) {
            expect(target.querySelectorAll('[data-k]')[0] && node.isConnected).toBe(true);
            expect(node).toBe(target.querySelector(`[data-k="${node.dataset.k}"]`), `node ${at}`);
        }

        // And the two renders agree everywhere the client has not deliberately
        // moved: the one node that changes is the effect's, because an effect
        // does not run on the server and does run here. That difference is the
        // contract, and pinning it is what would catch it becoming a mismatch.
        const moved = (text) => text.replace(/ouvertures=[^|]*/, 'ouvertures=…');

        expect(moved(shown(target))).toBe(moved(before));
        expect(target.querySelector('[data-k="ouvertures"]').textContent).toBe('ouvert:0');
    });
});
