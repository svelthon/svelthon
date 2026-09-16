// An instance is not its `__dict__`.
//
// The walk that takes an object under watch read the attributes out of the
// symbol-keyed dict Brython gives an instance. A class declaring `__slots__` has
// no such dict: each slot is an own property of the object named
// `slot_value_<name>`, written by the member descriptor. So the walk found
// nothing, and `box.rows.append(1)` changed the list while the page kept showing
// the old count.
//
// Read off the object and not asked of the class, which is what settles the
// three neighbours in one move and is why the fixture carries all three: a slot
// that is never assigned has no storage and is skipped rather than raising at
// mount, an inherited slot is stored exactly like a declared one, and nothing
// goes through `$getattr`, so watching runs no getter of the author's.
//
// The two fixtures differ by the two `__slots__` lines and nothing else.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SlotBox from './fixtures/SlotBox.svelte';
import AttrBox from './fixtures/AttrBox.svelte';

const setup = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();

    const read = (key) => target.querySelector(`[data-k="${key}"]`)?.textContent;

    return {
        read,
        bump: () => {
            target.querySelector('button[data-k="bump"]').click();
            flushSync();
        }
    };
};

describe.for([
    ['a slot', SlotBox],
    ['an attribute', AttrBox]
])('a list held in %s', ([, Component]) => {
    test('repaints what reads it', () => {
        const { read, bump } = setup(Component);

        expect(read('rows')).toBe('0');

        bump();

        expect(read('rows')).toBe('1');
    });

    test('and so does a dict held beside it', () => {
        const { read, bump } = setup(Component);

        expect(read('index')).toBe('0');

        bump();

        expect(read('index')).toBe('1');
    });
});
