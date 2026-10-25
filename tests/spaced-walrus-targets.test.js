// **A template `:=` writes through a target with blanks before a step**, as
// Python reads `items [0]` and `model .value`: `walrusTarget` looked for the
// dot or the bracket right after the name, gave up at the blank, and left the
// walrus to Python, which refused it, "cannot use assignment expressions with
// subscript", and the component did not compile.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpacedWalrusTargets from './fixtures/SpacedWalrusTargets.svelte';

const KEYS = ['dot', 'spaced', 'bracket', 'both', 'deep', 'index', 'line-dot', 'line-bracket'];

test('a template walrus writes through a target spaced before its dot or its bracket', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(SpacedWalrusTargets, { target });
    flushSync();

    const read = () => target.querySelector('output').textContent.split('|');
    const seen = [read()];

    for (const key of KEYS) {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
        seen.push(read());
    }

    expect(seen).toEqual(
        Array.from({ length: KEYS.length + 1 }, (_, done) => KEYS.map((_, at) => (at < done ? 'after' : 'before')))
    );
});
