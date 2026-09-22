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

    // The third dimension, and the one the first repair could not see: two
    // *instances* of one component, handed the same list to start from. The
    // binding text is `selected` in both and the list is one object, so neither
    // half of the identity tells them apart. What does is the instance — its own
    // namespace, which every one of its elements shares and no other instance
    // has.
    test('and so are two instances of one component', async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(GroupInstances, { target });
        flushSync();

        const read = (k) => target.querySelector(`p[data-k="held-${k}"]`).textContent;

        target.querySelector('[data-k="form"]').reset();
        await Promise.resolve();
        flushSync();

        expect(read('a')).toBe("['a']");
        expect(read('b')).toBe("['b']");
    });
});

// **A value goes into a group's list once, on the reset path as much as on the
// change path.** A form may show one option in two sections, and the reset put
// both controls back and added each of them: a selection nobody had touched
// came back as `['a', 'a']`, and what a form submits is the list.
//
// The rule is Python equality, so it is not about the *spelling* of a value
// either: `value={0.5}` written twice is two Brython floats, equal and not the
// same object, and `{#each}` rows put the same pair on every line.
//
// **Svelte is not the oracle for this one, and the row below says why.**
// Measured on the same form in its own language: Svelte answers a reset by
// writing the *model* back into the controls, so every box comes back off and
// the list stays empty — the form's own `checked` attributes lose. This file
// exists because the project chose the other direction, the one a Reset button
// means on a plain HTML form: the markup wins and the list is read back off it.
// So Svelte says what happens when nobody restores, and the shape of the list
// is ours to get right.
describe('a reset that brings back two controls for one value', () => {
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

    test('holds each value once, with the form s own controls back on', async () => {
        expect(await after(GroupResetDuplicate)).toEqual({
            selected: 'a',
            halves: '0.5',
            rows: 'x / x',
            checked: 'a1 a2 h1 h2 r0-1 r0-2 r1-1 r1-2'
        });
    });

    // The measurement that says the row above is a choice and not an accident,
    // kept here rather than in a note nobody re-runs.
    test('while Svelte writes the model back instead, and restores nothing', async () => {
        expect(await after(GroupResetDuplicateNative)).toEqual({
            selected: '',
            halves: '',
            rows: ' / ',
            checked: ''
        });
    });
});
