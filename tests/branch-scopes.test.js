// **A branch sees nothing of its sibling.** The `row` of `{#each rows as row}`
// does not exist in its `{:else}`, nor a declaration or a snippet of an `{#if}`
// branch in the `{:else}` one, and Svelte reads the script's name there. The
// markup pass kept one scope per block across its clauses, so the expression
// was handed a JavaScript argument that did not exist and the component died at
// mount with `row is not defined`.
//
// The same holds one level up: the expression that opens a block is read where
// the block stands, and a snippet of its body was preloaded before it.
//
// The last three are the other half: what a branch does bind is still seen.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BranchScopes from './fixtures/BranchScopes.svelte';

const setup = async () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(BranchScopes, { target });
    await Promise.resolve();
    flushSync();

    return (key) => target.querySelector(`[data-k="${key}"]`)?.textContent;
};

test.for([
    'each',
    'await',
    'declaration',
    'snippet',
    'else-if',
    // A snippet of the body is not a name of the head that opens it.
    'head-if',
    'head-else-if',
    'head-key',
    'head-each'
])(
    'a name bound in a sibling branch is the script’s in %s',
    async (key) => {
        expect((await setup())(key)).toBe('fallback');
    }
);

test.for([
    ['then', '6'],
    ['outer', 'outer'],
    ['late', 'late']
])('and what the branch binds is still seen: %s', async ([key, shown]) => {
    expect((await setup())(key)).toBe(shown);
});
