import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupReset from './fixtures/GroupReset.svelte';
import GroupShared from './fixtures/GroupShared.svelte';

// A form reset moves the controls without firing `change` on any of them. The
// group action listened for `change` alone, so after a reset the boxes on screen
// and the list in Python said different things — and the code that submits or
// validates reads the list.
//
// Svelte's own binding listens for `reset` on the document, in the capture
// phase, and does its work one microtask later, because the controls have not
// been put back yet when the event fires. This does the same.
describe('a group after a form reset', () => {
    const setup = async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(GroupReset, { target });
        flushSync();

        const at = (k) => target.querySelector(`[data-k="${k}"]`);

        return {
            read: (k) => at(k).textContent,
            click: (k) => {
                at(k).click();
                flushSync();
            },
            filled: (prefix) =>
                [...target.querySelectorAll(`input[data-k^="${prefix}"]`)]
                    .filter((one) => one.checked)
                    .map((one) => one.dataset.k)
                    .join(' '),
            reset: async () => {
                at('form').reset();
                await Promise.resolve();
                flushSync();
            }
        };
    };

    test('a checkbox group goes back to what the form shows', async () => {
        const { read, click, filled, reset } = await setup();

        click('c-a');
        expect(read('count')).toBe('2');

        await reset();
        expect(filled('c-')).toBe('');
        expect(read('selected')).toBe('[]');
    });

    test('a radio group comes back to its default', async () => {
        const { read, click, filled, reset } = await setup();

        click('r-y');
        expect(read('choice')).toBe('y');

        await reset();
        expect(filled('r-')).toBe('r-x');
        expect(read('choice')).toBe('x');
    });

    // The reset is a round trip, not a one-way street: what it restores has to
    // be writable again straight afterwards.
    test('and the group still writes after the reset', async () => {
        const { read, click, reset } = await setup();

        click('c-a');
        await reset();
        click('c-b');

        expect(read('selected')).toBe("['b']");
    });
});

// The rebuild has to know which inputs belong together, and this design gives
// the group no identity of its own: the first answer was the Python list they
// all hold, which is the one thing they share. It is not enough. Two bindings
// may hold the same list — `left = shared` and `right = shared` — and sharing a
// value is not sharing a binding: `right` came back holding `a`, a value none of
// its own controls carries.
describe('two groups that happen to hold one list', () => {
    test('are rebuilt apart', async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(GroupShared, { target });
        flushSync();

        const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;

        target.querySelector('[data-k="form"]').reset();
        await Promise.resolve();
        flushSync();

        expect(read('left')).toBe("['a']");
        expect(read('right')).toBe("['b']");
    });
});
