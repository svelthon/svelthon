// What a set holds is watched too.
//
// The walk that takes a container under watch marked a list's elements and a
// dict's values, and skipped a set on a sentence that said one could hold
// nothing worth walking, since a list is not hashable. **Hashable and immutable
// are two properties**: a user class is hashable by default and its attributes
// are mutable, so `{Box()}` holds exactly what the walk exists for.
//
// The fixtures differ by one character — `{Box()}` against `[Box()]` — and that
// is the whole argument: the list version repainted throughout, so nothing here
// is about the expression, the handler, or a mutation that failed.
//
// The third is the same object in a third position, a **key**. The dict walk
// followed values and not keys, on the same confusion: hashable is not
// immutable, and `{Box(): "label"}` is an ordinary way to index by an object.
// Nothing here redefines `__hash__` or `__eq__`, so mutating the key does not
// invalidate the entry — the dict is not disturbed, only the page was stale.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SetMember from './fixtures/SetMember.svelte';
import ListMember from './fixtures/ListMember.svelte';
import KeyMember from './fixtures/KeyMember.svelte';
import LateKey from './fixtures/LateKey.svelte';

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
    ['a set', SetMember],
    ['a list', ListMember],
    ['a dict key', KeyMember]
])('a mutable instance held by %s', ([, Component]) => {
    test('repaints what reads it', () => {
        const { read, bump } = setup(Component);

        expect(read('total')).toBe('0');

        bump();

        expect(read('total')).toBe('1');
    });

    // One level further down: the attribute is itself a container, and it was
    // reached by the same walk.
    test('and so does a container held by that member', () => {
        const { read, bump } = setup(Component);

        expect(read('tagged')).toBe('0');

        bump();

        expect(read('tagged')).toBe('1');
    });
});

// And the same key put there after the watch began.
//
// The initial walk hands the watch to both halves of an entry; the interception
// of an insertion handed it to the value alone. So a dict that was empty at
// mount held an untracked key for the rest of its life, and the repair above
// covered the dict written in the source and nothing written later.
test('a mutable key inserted under a watch is watched too', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(LateKey, { target });
    flushSync();

    const read = () => target.querySelector('[data-k="total"]').textContent;
    const press = (key) => {
        target.querySelector(`button[data-k="${key}"]`).click();
        flushSync();
    };

    press('add');

    expect(read()).toBe('0');

    press('bump');

    expect(read()).toBe('1');
});
