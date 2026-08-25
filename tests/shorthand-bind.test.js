import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Shorthand from './fixtures/Shorthand2.svelte';

// `bind:value` with no `={…}` is Svelte's shorthand for `bind:value={value}`.
// It used to slip past the pair — the scanner looks for an `=` and finds none —
// so Svelte bound its own `let` for the name.
//
// Measured: the three tests below **pass either way**, and the reason is worth
// knowing. A module-level Python name is emitted as `let name = $state.raw(…)`,
// so Svelte's own binding writes into the very cell the Python accessor reads.
// It worked by accident. What the expansion buys is the *setter* — which is
// where `track()` marks a bound container — and that no test here shows.
//
// The one that does catch something is the last, and it is how this was found:
// porting Svelte's file-input example, where `bind:files` handed Python's None
// to a DOM property and failed with `Failed to convert value to FileList`.
describe('the bind: shorthand', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Shorthand, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            field: (k) => target.querySelector(`input[data-k="${k}"]`)
        };
    };

    test('reads the Python name', () => {
        const { read, field } = setup();

        expect(read('value')).toBe('start');
        expect(field('text').value).toBe('start');
    });

    test('and writes back to it', () => {
        const { read, field } = setup();
        const input = field('text');

        input.value = 'typed';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();

        expect(read('value')).toBe('typed');
    });

    test('a checkbox too', () => {
        const { read, field } = setup();

        expect(read('checked')).toBe('False');
        field('box').click();
        flushSync();

        expect(read('checked')).toBe('True');
    });
});
