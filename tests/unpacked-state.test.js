// Every name of the module is state, whichever shape of assignment binds it.
// `a, b = 0, 0` binds two names as surely as two lines would, and a click that
// writes them has to show on the page like a click that writes `plain`. So does
// a walrus at module level, and a name whose only binding is a `global` in a
// function.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import UnpackedState from './fixtures/UnpackedState.svelte';

test('names bound by unpacking follow their writes, as a plain name does', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(UnpackedState, { target });
    flushSync();

    const shown = (k = 'shown') => target.querySelector(`[data-k="${k}"]`).textContent;

    expect(shown()).toBe('0 0 0 0 0 0 0 2');
    expect(shown('other')).toBe('0 0 0');

    target.querySelector('[data-k="bump"]').click();
    flushSync();

    // `c` and `e` are not written, and stay where they were.
    expect(shown()).toBe('1 1 1 0 1 0 1 3');
    expect(shown('other')).toBe('1 1 1');
});
