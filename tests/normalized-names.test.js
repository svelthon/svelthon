// An identifier is read in its NFKC form, as Python reads one, in the markup as
// in the script: `box.ﬁeld` is `box.field`, and an accent written in two code
// points is the one written in one. The engine read the spelling as written and
// raised `AttributeError`; once it read the normalized name, the markup pass
// looked for the dot `field`'s length behind the end of `ﬁeld`, one character
// too far, and refused the component.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import NormalizedNames from './fixtures/NormalizedNames.svelte';

test.for([
    ['ligature', 'field'],
    ['decomposed', 'composed'],
    ['lambda', 'field']
])('a name spelled %s reads the normalized attribute', ([k, expected]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(NormalizedNames, { target });
    flushSync();

    expect(target.querySelector(`[data-k="${k}"]`).textContent).toBe(expected);
});
