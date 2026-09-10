import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';

import HelperRefusal from './fixtures/HelperRefusal.svelte';
import { batch, date, fromnow } from '../src/lib/helpers.js';
import { pyError, NONE } from '../src/lib/runtime.js';

// The eighteen refusals in `compile.cjs` and `markup.js` all open with
// `svelthon — ` and all name a file. The three in `helpers.js` could do neither,
// and they are the three a beginner meets first: `{date(row.when)}` on a column
// that is sometimes empty is the ordinary way to reach one.
//
// They cannot know the file: they run at render time, inside a compiled
// `__expr_N`. So the sentence stays with the helper and the position is added by
// `pyError`, which the wrapper around every component function already calls
// with both. The mark is what tells it that this error is ours to complete.
describe('a helper refuses in the project’s own dialect', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(HelperRefusal, { target });
        flushSync();

        return instance;
    };

    test('the component still renders what is valid', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(HelperRefusal, { target });
        flushSync();

        expect(target.querySelector('[data-k="ok"]').textContent).toMatch(/2026/);
    });

    test.for([
        ['date', 'show_date', /date\(\): .* is not a date/],
        ['fromnow', 'show_fromnow', /fromnow\(\): .* is not a date/],
        ['batch', 'show_batch', /batch\(\): size must be an integer/]
    ])('%s says what is wrong, with the prefix and the position', ([, call, sentence]) => {
        const component = setup();

        expect(() => component[call]()).toThrow(sentence);
        expect(() => component[call]()).toThrow(/^svelthon — /);
        expect(() => component[call]()).toThrow(/\(\w+\(\) — .*HelperRefusal\.svelte\)/);
    });
});

describe('and the mark is what makes that possible', () => {
    // Without it, `pyError` would have to guess, and its rule is the opposite:
    // a JavaScript error carries its own message and stack and is not ours to
    // describe. SvelteKit's `error()` and `redirect()` cross through it.
    test('an unmarked JavaScript error is still left alone', () => {
        const foreign = new Error('from a library');

        expect(pyError(foreign, 'f() — src/App.svelte', 0).message).toBe('from a library');
    });

    test('a marked one is completed with where it was called', () => {
        let thrown;

        try {
            date(NONE);
        } catch (error) {
            thrown = error;
        }

        expect(thrown.message).not.toMatch(/src\/App\.svelte/);
        expect(pyError(thrown, 'label() — src/App.svelte', 0).message).toMatch(
            /\(label\(\) — src\/App\.svelte\)$/
        );
    });

    // Called twice on its way out through nested wrappers, it must not say it
    // twice.
    test('and only once, however many wrappers it crosses', () => {
        let thrown;

        try {
            fromnow('not a date');
        } catch (error) {
            thrown = error;
        }

        pyError(thrown, 'inner() — src/App.svelte', 0);
        const twice = pyError(thrown, 'outer() — src/App.svelte', 0);

        expect(twice.message.match(/src\/App\.svelte/g)).toHaveLength(1);
        expect(twice.message).toMatch(/\(inner\(\) — src\/App\.svelte\)$/);
    });

    test('a helper called outside a component still says what is wrong', () => {
        expect(() => batch([1], 0)).toThrow(/^svelthon — batch\(\): size must be an integer/);
    });
});
