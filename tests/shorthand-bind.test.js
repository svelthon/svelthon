import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Shorthand from './fixtures/Shorthand2.svelte';
import ShorthandEnds from './fixtures/ShorthandEnds.svelte';

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

// Where the shorthand *ends*, which is a third thing again.
//
// `bind:value` on its own is complete at a space, a slash or the `>`, and that
// three-character class is the only thing that says so. Measured on 2026-09-10:
// every shorthand in 130 fixtures was followed by a space, so dropping the `>`
// from the class passed all 811 tests. `<input bind:value>` is ordinary Svelte,
// and unexpanded it hands the directive to Svelte untouched: Svelte binds its
// own `let`, and the write never reaches Python.
//
// None is what makes the difference visible, for the reason the block below
// gives: expanded, it becomes undefined on the way to the DOM; unexpanded,
// Svelte writes the Python object into the property.
describe('where the shorthand ends', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(ShorthandEnds, { target });
        flushSync();

        return (k) => target.querySelector(`input[data-k="${k}"]`);
    };

    test.for([['a space', 'space'], ['a slash', 'slash'], ['the `>`', 'close']])(
        'a name that ends at %s is expanded',
        ([, key]) => {
            expect(setup()(key).value).toBe('');
        }
    );
});

// The one the shorthand tests above do *not* catch, and the reason the wrapper
// exists: Python's None is an object, so Svelte writes it into the property it
// binds. An `<input>` then shows the word "None", and `bind:files` fails
// outright with `Failed to convert value to FileList`, which is how this was
// found, porting Svelte's own file-input example.
describe('None at the DOM boundary', () => {
    test('an empty binding leaves the field empty, not the word None', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Shorthand, { target });
        flushSync();

        expect(target.querySelector('input[data-k="empty"]').value).toBe('');
    });
});
