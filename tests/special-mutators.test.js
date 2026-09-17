// The indexed statement and the method it compiles to.
//
// `__setitem__` and `__delitem__` were kept out of the followed names on the
// grounds that `rows[0] = 1` and `del rows[0]` compile to their own intercepted
// entry points. That is true of the *statement* and says nothing about an
// author calling the method by name, which is ordinary Python and is what a
// generic helper does: `rows.__setitem__(0, 1)`, the same method taken off the
// object and kept, or reached through the type.
//
// The indexed form is the witness on every line: it repainted throughout, so
// nothing here is about the expression or the handler.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpecialMutators from './fixtures/SpecialMutators.svelte';

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(SpecialMutators, { target });
    flushSync();

    return {
        read: () => target.querySelector('[data-k="rows"]').textContent,
        click: (key) => {
            target.querySelector(`button[data-k="${key}"]`).click();
            flushSync();
        }
    };
};

describe.for([
    ['the indexed statement', 'index', '[1]'],
    ['the method called by name', 'method', '[1]'],
    ['the method taken off the object', 'detached', '[1]'],
    ['the method reached through the type', 'type', '[1]'],
    ['and the deletion by name', 'delete', '[]']
])('a list mutated by %s', ([, key, after]) => {
    test('repaints what reads it', () => {
        const { read, click } = setup();

        expect(read()).toBe('[0]');

        click(key);

        expect(read()).toBe(after);
    });
});
