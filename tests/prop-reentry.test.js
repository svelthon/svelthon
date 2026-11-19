// A prop the child wrote reads the child's own value, `2.0`, while it holds
// it; once the parent passes another, a number equal to the child's write is
// the parent's: `3` then `2` reads the int 2, where it read the float the child
// wrote before, and `range()` raised. For a plain prop and a `bindable()` one.
//
// And the parent's `2` passed at once, or after a `3` the child never read, is
// the parent's too, as Svelte gives up the child's write when the parent passes
// a value. A parent bound to the prop holds the child's write: passing that
// value again passes nothing, and the child keeps its float.
import { test, expect } from 'vitest';
import { mount, flushSync, unmount } from './mounted.js';
import PropReentryParent from './fixtures/PropReentryParent.svelte';

const written = ['float|2.0|TypeError', 'float|2.0|TypeError'];

test.for([
    ['after a value it read', [[3], [2]], [['int|3|3', 'int|3|3'], ['int|2|2', 'int|2|2']]],
    ['at once', [[2]], [['int|2|2', 'float|2.0|TypeError']]],
    ['after a value it never read', [[3, 2]], [['int|2|2', 'float|2.0|TypeError']]]
])("a prop holds the child's write until the parent passes another value: %s", async ([, batches, expected]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(PropReentryParent, { target });
    const shown = () => [...target.querySelectorAll('p')].map((one) => one.textContent);
    const steps = [];

    flushSync();
    instance.own();
    flushSync();
    steps.push(shown());
    for (const batch of batches) {
        for (const next of batch) instance.replace(next);
        flushSync();
        steps.push(shown());
    }

    expect(steps).toEqual([written, ...expected]);

    await unmount(instance);
    target.remove();
});
