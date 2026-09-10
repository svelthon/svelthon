import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';

import OwnNames from './fixtures/OwnNames.svelte';

// Svelthon injects twenty-one names into a module's namespace, and the rule has
// always been that the author's own wins: a Python module that defines `list`
// shadows the builtin and loses it, and a component that defines `date` keeps
// its own.
//
// The rule only ever applied to four spellings. A name bound by a `class`, an
// `import`, a `for` target or a `with … as` was invisible to it, so the helper
// was injected over the author's name *and* their write was swallowed by the
// injection's empty setter. Their name never existed at all: reading it gave the
// helper for the rest of the module.
//
// Which is why this fixture imports from a little library of its own. Nobody
// writing `calendrier.py` has any reason to know that `date` is taken.
describe('a name the author took is the author’s', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(OwnNames, { target });
        flushSync();

        return (k) => target.querySelector(`[data-k="${k}"]`).textContent;
    };

    // The one that used to render `1 janv. 1970`: the import was discarded and
    // `date(3)` called Svelthon's helper with the timestamp 3, so the page was
    // plausible and wrong.
    test('a function imported from their own module is the one that runs', () => {
        expect(setup()('label')).toBe('day 3');
    });

    test('and so is a second one from the same import', () => {
        expect(setup()('grouped')).toBe('rows: [1, 2]');
    });

    // This one rendered `['<JavascriptFunction object>', '<JavascriptFunction
    // object>']`: the loop ran twice and appended the `js` helper both times.
    test('a loop variable holds what the loop gave it', () => {
        expect(setup()('looped')).toBe("['a', 'b']");
    });

    // The helper would have formatted this into a date in the reader's own
    // language, which is what made the failure so quiet: the page looked right.
    test('and a value the helper would have formatted is not formatted', () => {
        expect(setup()('formatted')).toBe('day 2026-09-10');
    });

    // `with … as slugify` binds a name too, and `slugify` is a helper.
    test('a with clause holds what the context manager gave it', () => {
        expect(setup()('held')).toBe('held');
    });
});
