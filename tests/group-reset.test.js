import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupReset from './fixtures/GroupReset.svelte';
import GroupShared from './fixtures/GroupShared.svelte';
import GroupInstances from './fixtures/GroupInstances.svelte';
import GroupResetDuplicate from './fixtures/GroupResetDuplicate.svelte';
import GroupResetDuplicateNative from './fixtures/GroupResetDuplicateNative.svelte';

// A form reset moves the controls without firing `change` on any of them. The
// group action listened for `change` alone, so after a reset the boxes on screen
// and the list in Python said different things — and the code that submits or
// validates reads the list.
//
// Svelte's own binding listens for `reset` on the document, in the capture
// phase, and does its work one microtask later, because the controls have not
// been put back yet when the event fires. This does the same, and answers as
// Svelte answers: the selection is emptied, `[]` or None, and the controls
// follow it, a default `checked` included.
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

    test('a checkbox group is emptied', async () => {
        const { read, click, filled, reset } = await setup();

        click('c-a');
        expect(read('count')).toBe('2');

        await reset();
        expect(filled('c-')).toBe('');
        expect(read('selected')).toBe('[]');
    });

    test('a radio group is emptied, its default included', async () => {
        const { read, click, filled, reset } = await setup();

        click('r-y');
        expect(read('choice')).toBe('y');

        await reset();
        expect(filled('r-')).toBe('');
        expect(read('choice')).toBe('');
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

// Each binding is emptied by the reset, whatever list it shares with another:
// `left = shared` and `right = shared` are two bindings, and two instances of
// one component handed one list are two groups.
describe('two groups that happen to hold one list', () => {
    test('are each emptied', async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(GroupShared, { target });
        flushSync();

        const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;

        target.querySelector('[data-k="form"]').reset();
        await Promise.resolve();
        flushSync();

        expect(read('left')).toBe('[]');
        expect(read('right')).toBe('[]');
        expect([...target.querySelectorAll('input')].filter((one) => one.checked)).toEqual([]);
    });

    test('and so are two instances of one component', async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(GroupInstances, { target });
        flushSync();

        const read = (k) => target.querySelector(`p[data-k="held-${k}"]`).textContent;

        target.querySelector('[data-k="form"]').reset();
        await Promise.resolve();
        flushSync();

        expect(read('a')).toBe('[]');
        expect(read('b')).toBe('[]');
        expect([...target.querySelectorAll('input')].filter((one) => one.checked)).toEqual([]);
    });
});

// A form whose controls carry `checked` by default, two of them for one value,
// in a list, as floats and in `{#each}` rows: the reset answers what the same
// form written in Svelte answers.
describe('a reset of controls checked by default', () => {
    const after = async (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();

        target.querySelector('[data-k="form"]').reset();
        await Promise.resolve();
        flushSync();

        const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;

        return {
            selected: read('selected'),
            halves: read('halves'),
            rows: read('rows'),
            checked: [...target.querySelectorAll('input')]
                .filter((one) => one.checked)
                .map((one) => one.dataset.k)
                .join(' ')
        };
    };

    test('empties the selections as Svelte does', async () => {
        expect(await after(GroupResetDuplicate)).toEqual(await after(GroupResetDuplicateNative));
    });

    // The witness: Svelte writes the emptied model back into the controls.
    test('the Svelte form is the rule', async () => {
        expect(await after(GroupResetDuplicateNative)).toEqual({
            selected: '',
            halves: '',
            rows: ' / ',
            checked: ''
        });
    });
});
