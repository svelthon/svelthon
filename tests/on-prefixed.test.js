import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';

import OnPrefixed from './fixtures/OnPrefixed.svelte';
import { pyEvent, NONE } from '../src/lib/bridge.js';

// What marks a handler is `on` followed by a lowercase letter, or Svelte 4's
// `on:`. That catches `onclick` and it also catches `once`, `only` and
// `onboarding`, which are ordinary words. Svelte 5 makes any `onfoo` prop a
// callback by convention, so the breadth is defensible for a component.
//
// What was not defensible is where it led: an attribute caught this way skips
// `__brycomp_bound`, and `__brycomp_bound` is the one place Python's None becomes `undefined` on
// the way to the DOM. So `once={missing}` wrote the None *object* into the
// attribute, which is the exact leak `__brycomp_bound` exists to stop, in the one
// position it did not reach.
//
// The repair is in `pyEvent` rather than in the test that marks a handler: a
// value that is not a Python function has nothing to wrap and is on its way to a
// DOM boundary like any other.
describe('an attribute that only looks like a handler', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(OnPrefixed, { target });
        flushSync();

        return (k) => target.querySelector(`[data-k="${k}"]`);
    };

    // A JavaScript child, because it is the only consumer that shows the
    // difference. A Python child reads the None object back as None and sees
    // nothing wrong, and a DOM element never receives an `on*` attribute at all,
    // since Svelte turns it into an event listener.
    test.for([['once'], ['only']])('%s holding None arrives as undefined', ([key]) => {
        expect(setup()(key).textContent).toBe('undefined');
    });

    // Breadth is not the defect, so a value that is not None still crosses.
    test('a value that is not None still crosses', () => {
        expect(setup()('onboarding').textContent).toBe('object');
    });

    // And the real handler is untouched by the repair.
    test('a real handler is still wrapped and still fires', () => {
        const button = setup()('handler');

        expect(() => {
            button.click();
            flushSync();
        }).not.toThrow();
    });
});

describe('pyEvent hands a non-callable to the DOM boundary', () => {
    test('None becomes undefined, which is what Svelte drops', () => {
        expect(pyEvent(NONE)).toBeUndefined();
    });

    // Only None. Zero, an empty string and False are values an attribute keeps.
    test.for([[0], [''], [false], ['x'], [5]])('%s crosses untouched', ([value]) => {
        expect(pyEvent(value)).toBe(value);
    });
});
