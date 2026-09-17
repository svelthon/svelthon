// The watch follows what a write *stored*, not what it was handed.
//
// A `__setattr__` of the author's may normalise its argument — `list(value)`,
// `tuple(value)`, a wrapper of their own — and the wrapper that follows an
// attribute write handed the watch to the value that came in. The list the object
// actually holds got none, so a later mutation of it through an alias the program
// already had notified nobody: the model held `[1]` and the page kept showing
// `[]`, with no error.
//
// It is not the setter that raises, which the pass before repaired: there the
// notification was skipped, here it happens and reaches the parent while the new
// child stays outside the watch. One write, two halves, and only the first had
// been looked at.
//
// The witness is the same component with the same setter, storing the value it
// was given instead of a copy of it. The two differ by that word.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SetterCopy from './fixtures/SetterCopy.svelte';

describe.for([
    ['stores a copy of what it is given', 'copied'],
    ['stores the value itself', 'direct'],
    // And the other half of the same question, a pass later: a setter may store
    // what it made under a name of its own, which is what a private field is.
    // Looking the written name up could never answer that one, so the object is
    // asked what it holds rather than what it was called.
    ['stores its copy under another name', 'renamed'],
    ['stores the value under another name', 'renamed_direct']
])('a setter that %s', ([, key]) => {
    test('repaints when the stored child is mutated', () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(SetterCopy, { target });

        flushSync();

        const read = (of) => target.querySelector(`[data-k="${of}"]`).textContent;
        const click = (what) => {
            target.querySelector(`button[data-k="${what}-${key}"]`).click();
            flushSync();
        };

        click('install');

        expect(read(key)).toBe('[]');

        click('mutate');

        // The model first, so a failure says which half moved: the mutation
        // always lands, and what is in question is whether anybody was told.
        expect(instance.model(key)).toBe('[1]');
        expect(read(key)).toBe('[1]');
    });
});
