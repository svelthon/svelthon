import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupTypes from './fixtures/GroupTypes.svelte';

// What a group binds is the author's value, not the DOM's spelling of it.
//
// `bind:group` is compiled to an action, and the action read `node.value`, which
// is text: `value={1}` came back as "1". So a number never matched the value it
// was written from, the initial button was empty, and clicking a checkbox left
// `[1, '1']` behind — the same choice under two types.
//
// The typed value cannot be recovered from the node either. Svelte keeps it on
// the hidden `__value` property only for an element it sees a group binding on
// (`needs_special_value_handling` in its RegularElement visitor), and ours no
// longer carries one. So the markup pass reads the tag's own `value` and hands
// the action a third member: the value the expression evaluated to.
describe('a group keeps the type of the value it was given', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(GroupTypes, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`input[data-k="${k}"]`).click();
                flushSync();
            },
            filled: (prefix) =>
                [...target.querySelectorAll(`input[data-k^="${prefix}"]`)]
                    .filter((one) => one.checked)
                    .map((one) => one.dataset.k)
                    .join(' ')
        };
    };

    test('a radio filled from a number', () => {
        const { read, click, filled } = setup();

        expect(filled('r-')).toBe('r-2');
        click('r-3');
        expect(read('chosen')).toBe('3');
        expect(filled('r-')).toBe('r-3');
    });

    test('and the number stays a number', () => {
        const { read, click } = setup();

        expect(read('chosen-type')).toBe('int');
        click('r-3');
        expect(read('chosen-type')).toBe('int');
    });

    test('a checkbox group collects numbers', () => {
        const { read, click, filled } = setup();

        expect(filled('c-')).toBe('c-1');
        click('c-2');
        expect(read('picked')).toBe('[1, 2]');
        expect(read('picked-types')).toBe("['int', 'int']");
    });

    test('and unchecking removes the one that is there', () => {
        // The removal compared the same two spellings, so a number was never
        // found and the list only ever grew.
        const { read, click } = setup();

        click('c-1');
        expect(read('picked')).toBe('[]');
    });

    test('a float, which is an object and not a number', () => {
        const { read, click, filled } = setup();

        expect(filled('f-')).toBe('f-0.5');
        click('f-1.5');
        expect(read('ratio')).toBe('1.5');
        expect(read('ratio-type')).toBe('float');
        expect(filled('f-')).toBe('f-1.5');
    });

    test('the value may be written before the binding', () => {
        const { read, click, filled } = setup();

        expect(filled('b-')).toBe('b-2');
        click('b-1');
        expect(read('chosen')).toBe('1');
        expect(read('chosen-type')).toBe('int');
    });
});
