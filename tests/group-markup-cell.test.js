import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupMarkupCell from './fixtures/GroupMarkupCell.svelte';
import GroupMarkupCellNative from './fixtures/GroupMarkupCellNative.svelte';
import GroupMarkupCellSpelled from './fixtures/GroupMarkupCellSpelled.svelte';

// A `bind:group` whose target the markup declares, `{picked = []}`, writes that
// cell, as Svelte's does, and each row of an `{#each}` is a cell of its own:
// two rows starting from one shared list, or holding the same number, are still
// two groups. Clicked, typed into and reset, the Python form reads what the
// Svelte one reads at every step.
const steps = async (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    const at = (row, k) => target.querySelector(`[data-row="${row}"] [data-k="${k}"]`);
    const read = () => [0, 1].map((row) => at(row, 'state').textContent).join(' / ');
    const seen = [read()];

    const click = (row, k) => {
        at(row, k).click();
        flushSync();
        seen.push(read());
    };

    click(0, 'picked');
    click(1, 'picked');
    click(0, 'held');
    click(1, 'held');
    click(1, 'choice');
    click(0, 'picked');

    at(0, 'amount').value = '0.75';
    at(0, 'amount').dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    seen.push(read());

    target.querySelector('[data-k="form"]').reset();
    await Promise.resolve();
    flushSync();
    seen.push(read());

    return seen;
};

test('a group bound to a cell the markup declares reads as Svelte reads it', async () => {
    expect(await steps(GroupMarkupCell)).toEqual(await steps(GroupMarkupCellNative));
});

// The cell is known by the name the binding writes, as Python reads it:
// `(picked)`, `chosen # kept` and `field` for a declared `ﬁeld` each found no
// cell, and the two blocks' groups, holding one list, were taken for one.
// Svelte's two `{let picked = $state.raw(shared)}` read `A / B`.
test.for([0, 1, 2])('a group target spelled otherwise still writes its own cell (pair %i)', (pair) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(GroupMarkupCellSpelled, { target });
    flushSync();

    const blocks = [...target.querySelectorAll(`[data-pair="${pair}"]`)];
    const read = () => blocks.map((block) => block.querySelector('p').textContent).join(' / ');
    const seen = [read()];

    for (const block of blocks) {
        block.querySelector('input').click();
        flushSync();
        seen.push(read());
    }

    expect(seen).toEqual(['B / B', 'A / B', 'A / ']);
});

// The witness: each row writes its own cell, the row that started from the
// shared list keeps only what its own controls hold, and the reset empties
// every control, the number included.
test('the Svelte form is the rule', async () => {
    expect(await steps(GroupMarkupCellNative)).toEqual([
        '|v1|0|0.25 / |v1|0|0.25',
        'v0|v1|0|0.25 / |v1|0|0.25',
        'v0|v1|0|0.25 / v1|v1|0|0.25',
        'v0|v0|0|0.25 / v1|v1|0|0.25',
        'v0|v0|0|0.25 / v1||0|0.25',
        'v0|v0|0|0.25 / v1||2|0.25',
        '|v0|0|0.25 / v1||2|0.25',
        '|v0|0|0.75 / v1||2|0.25',
        '||| / |||'
    ]);
});
