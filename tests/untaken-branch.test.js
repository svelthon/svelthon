// **A name a branch does not take is not read**, as Python reads a branch:
// a template expression is handed the names it reads as functions, and reads
// one only where the branch it sits in runs. Read before the expression ran,
// `{7 if True else y}` ran `y`'s derived, and a snippet's parameter its
// default, and the page failed on what the branch excluded, where Svelte, in
// production, reads nothing for `true ? 7 : y`. In development Svelte reads a
// `{@const}` and a snippet's parameter ahead for its own checks, so the
// answers are CPython's. A branch that is taken still reads, and still fails.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import UntakenBranch from './fixtures/UntakenBranch.svelte';

const shown = (kind) => {
    const target = document.body.appendChild(document.createElement('div'));

    try {
        mount(UntakenBranch, { target, props: { kind } });
        flushSync();

        return target.querySelector('output').textContent;
    } catch (error) {
        return String(error?.message ?? error).includes('branch-was-read') ? 'read' : String(error);
    }
};

test.for([
    ['if true', '7'],
    ['if false', '7'],
    ['and', '9'],
    ['or', '7'],
    ['lambda', '7'],
    ['taken', 'read']
])('a branch %s shows %s', ([kind, answer]) => {
    expect(shown(kind)).toBe(answer);
});
