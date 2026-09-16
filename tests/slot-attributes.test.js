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

// The other half, and it did not follow from the first: repairing the watch left
// the *crossing* untouched.
//
// An instance is rebuilt from its `__dict__`. A slotted one has none, so it fell
// through to the mapping walk and JavaScript was handed the engine's own view of
// the object — `{ob_type, slot_value_rows}` — which `JSON.stringify` refuses,
// circular through the class. Adding `__slots__` to a model renamed its data and
// made the result unserialisable, for an object whose Python API had not changed.
//
// `ordinary()` is the control on every line: same attribute, same value, and the
// shape that was never in doubt.
describe('a slotted instance crossing to JavaScript', () => {
    const mod = () => import('./fixtures/slotted_export.py');

    test('hands over what the author wrote, under the name they wrote', async () => {
        const { slotted, ordinary } = await mod();

        expect(slotted()).toEqual(ordinary());
        expect(slotted()).toEqual({ rows: [1] });
    });

    test('and the result is serialisable, which it was not', async () => {
        expect(JSON.stringify((await mod()).slotted())).toBe('{"rows":[1]}');
    });

    test('an inherited slot is a field like any other', async () => {
        expect((await mod()).inherited()).toEqual({ rows: [1] });
    });

    // `__slots__` naming `__dict__` keeps both kinds of storage, and both are
    // the author's data.
    test('an instance with slots and a dict hands over both', async () => {
        expect((await mod()).mixed()).toEqual({ rows: [1], label: 'both' });
    });

    test('a slot never assigned is not a field', async () => {
        const out = (await mod()).partial();

        expect(out).toEqual({ rows: [1] });
        expect(Object.hasOwn(out, 'later')).toBe(false);
    });

    // The graph rule holds through the slot path too: one Python list is one
    // array however it is reached.
    test('and a list reached through a slot is the one list', async () => {
        const out = (await mod()).shared();

        expect(out.box.rows).toBe(out.rows);
    });
});
