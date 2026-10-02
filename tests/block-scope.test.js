import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BlockScope from './fixtures/BlockScope.svelte';
import AssignedForms from './fixtures/AssignedForms.svelte';

// A `for` target, a `with … as` and a `match` capture assign a value to a name
// of the module, as `=` does, so the name is state: a list bound by one of them
// and appended to by a handler left the page at its old length.
test('a name a for, a with or a match assigns follows the DOM', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(AssignedForms, { target });
    flushSync();

    const shown = () => Object.fromEntries([...target.querySelectorAll('p')].map((p) => [p.dataset.k, p.textContent]));
    const before = shown();

    target.querySelector('button').click();
    flushSync();

    const after = shown();

    for (const key of Object.keys(before)) expect([key, Number(after[key])]).toEqual([key, Number(before[key]) + 1]);
});

// `surface()` used to walk the module's top-level statements and stop there, so
// a name bound inside a block never became a signal. It stayed *readable* —
// Brython writes an own property and the lookup finds it — so the first render
// was right and nothing moved afterwards, with no error to say why.
describe('a name bound inside a block is module state', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(BlockScope, { target });
        flushSync();

        return {
            at: (k) => target.querySelector(`[data-k="${k}"]`).textContent,
            bump: () => {
                target.querySelector('button').click();
                flushSync();
            }
        };
    };

    const reactive = [
        ['at the left margin', 'plain'],
        ['under an `if`', 'conditional'],
        ['inside a `for`', 'looped'],
        ['inside a `try`', 'guarded'],
        ['inside a `finally`', 'cleaned'],
        ['two blocks deep', 'nested']
    ];

    for (const [where, key] of reactive) {
        test(`a name ${where} follows the DOM`, () => {
            const { at, bump } = setup();
            expect(at(key)).toBe('0');
            bump();
            expect(at(key)).toBe('1');
        });
    }

    // A branch that never runs binds nothing, in Python as anywhere else, so
    // these three start empty rather than at 0. Declaring them changes nothing
    // about that — measured with and without the descent, both render empty and
    // neither raises. What matters is that the first write reaches the DOM.
    for (const [where, key] of [
        ['an `else` that never ran', 'unreached'],
        ['a `while` that never ran', 'never'],
        ['an `except` that never fired', 'handled']
    ]) {
        test(`a name in ${where} is empty until it is written`, () => {
            const { at, bump } = setup();
            expect(at(key)).toBe('');
            bump();
            expect(at(key)).toBe('1');
        });
    }

    // `def` and `class` are the scopes Python actually has, and the descent
    // stops at both: a name bound there is not module state, and turning it into
    // a signal would rename an attribute or a local out from under its owner.
    test('a class attribute stays an attribute', () => expect(setup().at('attribute')).toBe('0'));

    test('a local stays local', () => expect(setup().at('call')).toBe('0'));
});
