import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BlockScope from './fixtures/BlockScope.svelte';
import AssignedForms from './fixtures/AssignedForms.svelte';
import StarImported from './fixtures/StarImported.svelte';
import StarPlain from './fixtures/StarPlain.svelte';
import DictViews from './fixtures/DictViews.svelte';
import VoidNamedComponents from './fixtures/VoidNamedComponents.svelte';

// HTML's void elements have no body, and `<Input>` and `<Link>` are components:
// their opening pushed no scope and their closing popped the loop's, so the
// next `{row}` was a module name and raised NameError.
test('a component named like a void element keeps the loop name after it', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(VoidNamedComponents, { target });
    flushSync();

    expect([...target.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['1', '1', '1', '2', '2', '2']);
});

// `keys()`, `values()` and `items()` are live views of their dict, and so is
// the read-only `mappingproxy` a view hands out as `.mapping`: kept in a name,
// each follows an entry added, an entry removed, and a value changed in place,
// as the dict itself does.
test('a dict view kept in a name follows its dict', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(DictViews, { target });
    flushSync();

    const shown = () =>
        ['keys', 'values', 'items', 'proxy'].map((k) => target.querySelector(`p[data-k="${k}"]`).textContent);
    const click = (k) => {
        target.querySelector(`button[data-k="${k}"]`).click();
        flushSync();
    };

    click('grow');
    expect(shown()).toEqual(['first,second', '[1, 1]', "[('first', 1), ('second', 1)]", 'first,second']);

    click('shrink');
    expect(shown()).toEqual(['second', '[1]', "[('second', 1)]", 'second']);

    click('change');
    expect(shown()).toEqual(['second', '[2]', "[('second', 2)]", 'second']);
});

// `from m import *` binds names no statement lists, so the compiler cannot
// give them a signal: the runtime gives each its accessor as the import binds
// it, and a list imported this way repaints what reads it, as one imported by
// name does. A function among them is still the module's.
test('a name a star import binds follows the DOM', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(StarImported, { target });
    flushSync();

    const at = (k) => target.querySelector(`[data-k="${k}"]`).textContent;
    const before = Number(at('rows'));

    target.querySelector('button').click();
    flushSync();

    expect([Number(at('rows')), at('label')]).toEqual([before + 1, 'from the module']);
});

// And from a module with no `__all__`, which hands over every name that does
// not start with an underscore, as CPython's `import *` does.
test('a star import of a module with no __all__ takes its public names', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(StarPlain, { target });
    flushSync();

    const at = (k) => target.querySelector(`[data-k="${k}"]`).textContent;
    const before = Number(at('rows'));

    target.querySelector('button').click();
    flushSync();

    expect([Number(at('rows')), at('label'), at('hidden')]).toEqual([before + 1, 'from the module', 'False']);
});

// A `for` target, a `with … as`, a `match` capture and an import bind a name of
// the module to a value, as `=` does, so the name is state: a list bound by one
// of them and appended to by a handler left the page at its old length.
test('a name a for, a with, a match or an import binds follows the DOM', () => {
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
