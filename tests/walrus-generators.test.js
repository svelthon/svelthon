// **A walrus that is a generator's element leaves the generator its `for`**:
// `(value := n for n in xs)` is a generator whose element assigns, and the
// rewrite took the clause for the value, `__brycomp_assign("value", n for n in xs)`,
// which Python refuses, so the component did not compile.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import WalrusGenerators from './fixtures/WalrusGenerators.svelte';

test('a generator whose element is a walrus yields what it assigns', () => {
    const received = [];
    const target = document.body.appendChild(document.createElement('div'));
    mount(WalrusGenerators, { target, props: { sink: (value) => received.push(JSON.stringify(value)) } });
    flushSync();

    for (const key of ['plain', 'filtered', 'pairs']) target.querySelector(`[data-k="${key}"]`).click();
    flushSync();

    expect(received).toEqual(['[1,2]', '[1,3]', '[[1,11],[2,12]]']);
});
