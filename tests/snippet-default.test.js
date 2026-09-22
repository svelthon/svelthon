// **A snippet's parameter may carry a default, and a default is an
// expression.**
//
// The branch passed a snippet declaration through as written, on the sentence
// *a snippet declares names and holds no expression of its own*. It holds one
// as soon as a parameter has a default: `{#snippet row(value=True)}` handed
// Svelte a JavaScript `True` and the component died at mount with
// `ReferenceError: True is not defined` — while `{@render row(False)}` beside
// it worked, because an argument **given** is compiled and one **defaulted**
// took another path.
//
// The other half was quieter: the names were read by pulling identifiers out of
// the whole parameter text, so `True` went into scope as if the author had
// bound it.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SnippetDefault from './fixtures/SnippetDefault.svelte';

describe('a snippet parameter default', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(SnippetDefault, { target });
        flushSync();

        return (k) => target.querySelector(`[data-k="${k}"]`).textContent.trim();
    };

    test('is Python, not a JavaScript name that happens to spell it', () => {
        expect(setup()('seul')).toBe('True');
    });

    test('and may read what the module holds, beside a parameter without one', () => {
        expect(setup()('deux')).toBe('x:6');
    });

    // A comma and a quote inside the default belong to it: the parameter list is
    // split at the top level, not at the first comma written.
    test('and may hold a comma inside a string', () => {
        expect(setup()('texte')).toBe('a, b');
    });

    test('while a parameter without one is unchanged', () => {
        expect(setup()('aucun')).toBe('False');
    });

    test('and an argument given wins over the default', () => {
        expect(setup()('donne')).toBe('False');
    });
});
