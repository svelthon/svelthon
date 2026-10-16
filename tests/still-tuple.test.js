// **A tuple holding nothing that can change is not watched**, so reading it
// through each of the rows that hold it costs what the rows are. Watched, it
// gathered every row as a parent, and each read climbed them all: an option
// value shared by a thousand selects made their mount quadratic. A tuple
// holding a list, or one of a subclass, which has attributes, is watched still,
// and what changes in it repaints the page.
//
// Timed against the same rows in Svelte, mounted in the same run: a bound in
// milliseconds read the machine's load as much as the code, 1 169 and 1 743 ms
// over 1 000 under a full suite. Neither the mount nor its growth tells a
// watched tuple from a still one any more, the walk reading each row once
// (measured with `stillTuple` answering no: 582 ms against 569); what is kept is
// the bound, an order of magnitude below the quadratic climb.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import { timed } from './growth.js';
import StillTuple from './fixtures/StillTuple.svelte';
import StillTupleNative from './fixtures/StillTupleNative.svelte';

test('reading a tuple of numbers through each of 3,000 rows costs what the rows cost in Svelte', () => {
    const mounted = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        let instance;
        const spent = timed(() => {
            instance = mount(Component, { target, props: { kind: 'numbers', n: 3000 } });
            flushSync();
        });
        const shown = target.querySelector('p').textContent;

        unmount(instance);
        target.remove();

        return { spent, shown };
    };
    const best = (Component) => Math.min(...[0, 1, 2].map(() => mounted(Component).spent));

    expect(mounted(StillTuple).shown).toBe(mounted(StillTupleNative).shown);
    expect(best(StillTuple)).toBeLessThan(3 * best(StillTupleNative));
});

test.for([
    ['list inside', '1', '2'],
    ['subclass', 'old', 'new']
])('a tuple with %s is watched still: %s becomes %s', ([kind, before, after]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(StillTuple, { target, props: { kind, n: 3 } });
    flushSync();
    expect(target.querySelector('p').textContent).toBe(before);

    target.querySelector('button').click();
    flushSync();
    expect(target.querySelector('p').textContent).toBe(after);
});
