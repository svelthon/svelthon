// **The target of an `{#each}` destructures, and a destructuring holds
// expressions.**
//
// The same sentence as a snippet's parameter list, at the other site of the
// markup that declares names — and it was written at one of the two. A snippet
// had just learned to walk its patterns and compile the defaults inside them;
// `eachBlock` handed its target to Svelte as the author wrote it, so
// `{#each rows as [value=True]}` died at mount with `ReferenceError: True is
// not defined`, and `[value=len(xs)]` looked for `len` in JavaScript.
//
// And the same miss took the names with it: the identifiers were read off the
// whole target, so a default's own names were declared as the block's.
//
// **These have to be rendered, not merely built.** `True` is a perfectly good
// JavaScript identifier, so the component compiles either way and the fault
// only appears when the block runs. A markup-level assertion would have passed
// throughout.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import EachTarget from './fixtures/EachTarget.svelte';
import EachTargetNative from './fixtures/EachTargetNative.svelte';

const rendered = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    return Object.fromEntries(
        [...target.querySelectorAll('i')].map((one) => [one.dataset.k, one.textContent])
    );
};

describe('an {#each} target', () => {
    // The shapes, read off Svelte executed on the same seven targets in its own
    // language. What a target may hold is its rule, not ours, and the day it
    // narrows, the row that says so is in the tree.
    test('holds what Svelte holds, and answers what Svelte answers', () => {
        const ours = rendered(EachTarget);
        const theirs = rendered(EachTargetNative);

        expect(Object.fromEntries(Object.keys(theirs).map((k) => [k, ours[k]]))).toEqual(theirs);
    });

    // And the witness that comparison cannot give: that both are the right
    // answer rather than the same wrong one.
    test('and the answers are the ones the loop was written for', () => {
        expect(rendered(EachTargetNative)).toEqual({
            a: '5:5',
            b: '5:0',
            c: '5',
            d: '5',
            e: '5',
            f: '1',
            g: '5'
        });
    });

    // What only Python can say, and the whole defect: a default that stays in
    // JavaScript compiles and then throws.
    test.for([
        ['a builtin of the language the template is written in', 'h', 'True'],
        ['and a call to one', 'j', '2:3']
    ])('a default is %s', ([, key, answer]) => {
        expect(rendered(EachTarget)[key]).toBe(answer);
    });

    // A tuple target is how Python unpacks and what `.items()` hands over, and
    // it was already translated. The call inside one was not: the translation
    // replaced **every** parenthesis in the target, so the first call written
    // in a default came out as `len[1, 2]`. A walk translates the delimiters it
    // recognised and leaves an expression alone.
    test('a tuple target is still Svelte s brackets', () => {
        expect(rendered(EachTarget).k).toBe('1:2');
    });

    test('and a call inside one keeps its own parentheses', () => {
        expect(rendered(EachTarget).m).toBe('1:2');
    });

    // The names half, and it needs a name JavaScript does not have. A module's
    // own names are emitted as bindings, so declaring one twice is invisible;
    // `len` is Python's and nothing else's, so a block that declares it looks
    // for a JavaScript `len` that nothing wrote and the row throws instead of
    // answering. Which is why the row above reads `len` in its body as well as
    // in its default.
    test('a name a default reads is not a name the block declares', () => {
        expect(rendered(EachTarget).j).toBe('2:3');
    });
});
