// Updating every row of a watched table costs what the rows are, not their
// square. A mutation checks that each link it crosses still holds, and that
// check reads the one entry the row entered under, not the whole table: 10,000
// rows of a dict took seconds when it read them all, once per row.
//
// Measured as it grows (`growth`): four times the rows take about four times as
// long, where reading the whole table once per row took sixteen. A bound in
// milliseconds read the machine's load as much as the code.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import { growth, timed } from './growth.js';
import RowTable from './fixtures/RowTable.svelte';
import ShapedTable from './fixtures/ShapedTable.svelte';

// The table mounted, then every row marked in one click: the time of the click,
// and what the page counts after it.
const marking = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });

    flushSync();

    const spent = timed(() => {
        target.querySelector('button').click();
        flushSync();
    });
    const shown = target.querySelector('p').textContent;

    unmount(instance);
    target.remove();

    return { spent, shown };
};

// The same for a grid keyed by tuples, whose hash runs no code of the author's,
// and a set, read by the bucket each member was found in.
test.for(['grid', 'set'])('marking every cell of a %s is linear', (kind) => {
    const run = (n) => marking(ShapedTable, { kind, side: Math.round(Math.sqrt(n)) });

    expect(run(10000).shown).toBe('10000');
    expect(growth((n) => run(n).spent)).toBeLessThan(8);
});

test.for(['dict', 'list'])('marking every row of a %s is linear', (kind) => {
    const run = (n) => marking(RowTable, { kind, n });

    expect(run(10000).shown).toBe('10000');
    expect(growth((n) => run(n).spent)).toBeLessThan(8);
});
