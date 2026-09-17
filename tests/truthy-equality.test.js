// `bind:group` asked Python, then read the answer as JavaScript.
//
// Which member of a group is the selected one is decided by Python's `==`, and
// that was right: `rich_comp('__eq__', …)`. What followed was `=== true`, a
// narrower question than the one asked — `__eq__` may return anything, and
// `return int(self.n == other.n)` gives 1, true to Python and not the JavaScript
// boolean. A choice already present in the state showed as unselected, with the
// comparison answering True the whole time.
//
// The witness differs by one word: the same class returning the comparison
// directly instead of `int(...)`.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TruthyEquality from './fixtures/TruthyEquality.svelte';
import RaisingEquality from './fixtures/RaisingEquality.svelte';

describe('a group whose __eq__ answers something other than a bool', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(TruthyEquality, { target });
        flushSync();

        return (key) => target.querySelector(`[data-k="${key}"]`);
    };

    test('Python says the two are equal', () => {
        expect(setup()('equal').textContent).toBe('True');
    });

    test.for([['radio'], ['box']])('and the %s is checked', ([key]) => {
        expect(setup()(key).checked).toBe(true);
    });

    // The witness: `__eq__` returning the comparison itself, which always
    // worked.
    test.for([['plain-radio'], ['plain-box']])('as the %s always was', ([key]) => {
        expect(setup()(key).checked).toBe(true);
    });
});

// And the other half of asking Python: the answer may be an exception.
//
// The fall back to identity is for a value Python cannot compare at all — a
// foreign JavaScript one. Using it for an `__eq__` that *raised* answered
// plausibly and wrongly: two distinct instances, so the control showed nothing
// selected while the model had failed to compare anything.
test('an __eq__ that raises reaches the author', () => {
    const target = document.body.appendChild(document.createElement('div'));

    expect(() => {
        mount(RaisingEquality, { target });
        flushSync();
    }).toThrow(/comparison failed/);
});
