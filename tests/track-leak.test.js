import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { marks, track } from '../src/lib/runtime.js';
import Host from './fixtures/LeakHost.svelte';

// A container shared through a store carries one marker holding the bump and
// read callbacks of everyone who tracked it. Mounting adds one; unmounting used
// to remove nothing, so the list kept the callbacks of components that were
// gone and the count went 2, 3, 4, 5 for one child alive.
//
// The two numbers on screen are the children alive, which the components count
// themselves, and the subscribers the list believes in. The test is that they
// stay apart by a constant: one subscriber is the store's own, registered when
// the module ran `rows = []`, and it never goes away.
//
// Two children, the list held in a name `=` bound and in one a `def` bound
// first: a cell is a cell, and each signs off when its component goes.
test('unmounting unsubscribes from a shared container', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Host, { target });
    flushSync();

    const read = () =>
        ['alive', 'subscribed']
            .map((k) => target.querySelector(`[data-k="${k}"]`).textContent)
            .join('/');

    const cycle = () => {
        for (const _ of [0, 1]) {
            target.querySelector('button').click();
            flushSync();
        }

        return read();
    };

    expect([read(), cycle(), cycle(), cycle()]).toEqual(['2/3', '2/3', '2/3', '2/3']);
});

// The same list, read from the other side, and the second defect the same cause
// produced. Handing a child the watch used to mean copying the parent's
// subscribers into it, so a subscriber that arrived afterwards was in the
// parent's list and in no child's: mutating a row notified the first component
// to read the table and not the second. Measured at 1 and 0.
//
// The link runs the other way now, from the child up to its parents, so there
// is one list per container and arriving late changes nothing.
test('a subscriber that arrives late still hears about the children', () => {
    const rows = [[]];
    let first = 0;
    let second = 0;

    track(rows, () => first++, () => {});
    track(rows, () => second++, () => {});

    marks(rows[0])();

    expect([first, second]).toEqual([1, 1]);
});
