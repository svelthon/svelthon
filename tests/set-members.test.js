// What a set holds is watched too.
//
// The walk that takes a container under watch marked a list's elements and a
// dict's values, and skipped a set on a sentence that said one could hold
// nothing worth walking, since a list is not hashable. **Hashable and immutable
// are two properties**: a user class is hashable by default and its attributes
// are mutable, so `{Box()}` holds exactly what the walk exists for.
//
// The two fixtures differ by one character — `{Box()}` against `[Box()]` — and
// that is the whole argument: the list version repainted throughout, so nothing
// here is about the expression, the handler, or a mutation that failed.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SetMember from './fixtures/SetMember.svelte';
import ListMember from './fixtures/ListMember.svelte';

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
    ['a list', ListMember]
])('a mutable member of %s', ([, Component]) => {
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
