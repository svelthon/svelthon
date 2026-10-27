// **A template `:=` writes through a slice**, as `items[0:1] = [9]` writes
// one: `walrusTarget` left any key holding a colon to Python, which refused the
// walrus as CPython refuses one on a subscript, "cannot use assignment
// expressions with subscript", where every other key was written. The colon
// of a lambda still cuts no slice.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SliceWalrusTargets from './fixtures/SliceWalrusTargets.svelte';

test('a template walrus writes through a slice, and a lambda key stays a key', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(SliceWalrusTargets, { target });
    flushSync();

    const seen = [target.querySelector('output').textContent];

    for (const key of ['slice', 'open', 'step', 'whole', 'lambda']) {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
        seen.push(target.querySelector('output').textContent);
    }

    expect(seen).toEqual([
        '[1, 2, 3]|[1, 2, 3, 4]|[1, 2]|[]',
        '[9, 2, 3]|[1, 2, 3, 4]|[1, 2]|[]',
        '[9, 5]|[1, 2, 3, 4]|[1, 2]|[]',
        '[9, 5]|[7, 2, 8, 4]|[1, 2]|[]',
        '[9, 5]|[7, 2, 8, 4]|[0]|[]',
        "[9, 5]|[7, 2, 8, 4]|[0]|['kept']"
    ]);
});
