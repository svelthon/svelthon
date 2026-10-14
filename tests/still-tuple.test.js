// **A tuple holding nothing that can change is not watched**, so reading it
// through each of the rows that hold it costs what the rows are. Watched, it
// gathered every row as a parent, and each read climbed them all: an option
// value shared by a thousand selects made their mount quadratic. A tuple
// holding a list, or one of a subclass, which has attributes, is watched still,
// and what changes in it repaints the page.
//
// The bound is absolute and generous, as in `row-updates-linear.test.js`: the
// quadratic climb is an order of magnitude above it.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import StillTuple from './fixtures/StillTuple.svelte';

test('reading a tuple of numbers through each of 3,000 rows is linear', () => {
    const target = document.body.appendChild(document.createElement('div'));

    const started = performance.now();
    mount(StillTuple, { target, props: { kind: 'numbers' } });
    flushSync();
    const spent = performance.now() - started;

    expect(target.querySelector('p').textContent).toBe('6000');
    expect(spent).toBeLessThan(1000);
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
