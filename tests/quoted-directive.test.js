import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import QuotedDirective from './fixtures/QuotedDirective.svelte';

// `bind:value={x}` and `bind:value="{x}"` are the same thing to Svelte 5, and
// the Svelte team's own fixtures write the quoted form 76 times. To the scanner
// they were two doors: the bare one ran the ladder where every rule lives, the
// quoted one ran the text branch, which knows `__text` and nothing about
// directives.
//
// The fourth time of the same shape: a rule wired into one spelling of a
// construct and not the other.
describe('a quoted directive is the bare one', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(QuotedDirective, { target });
        flushSync();

        return {
            field: (k) => target.querySelector(`input[data-k="${k}"]`),
            node: (k) => target.querySelector(`[data-k="${k}"]`)
        };
    };

    // The oldest rule in the project, reached through a third door. Skipping the
    // read/write pair skips `__bound`, and `__bound` is the one place Python's
    // None becomes undefined on the way to the DOM. The field showed the word.
    test('None in a quoted binding leaves the field empty, as it does bare', () => {
        const { field } = setup();

        expect(field('quoted_none').value).toBe('');
        expect(field('quoted_none').value).toBe(field('bare_none').value);
    });

    test('and a value still reads through', () => {
        expect(setup().field('quoted_text').value).toBe('start');
    });

    // An empty Python list is false, and JavaScript calls it true. Read as text
    // through the quotes, the class was applied for an empty list.
    test('a quoted class: is read for truthiness, as it is bare', () => {
        const { node } = setup();

        expect(node('quoted_class').classList.contains('on')).toBe(false);
        expect(node('quoted_class').className).toBe(node('bare_class').className);
    });

    test('a quoted handler runs', () => {
        const { node } = setup();

        node('quoted_click').click();
        flushSync();

        expect(node('typed').textContent).toBe('clicked');
    });
});
