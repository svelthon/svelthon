// Every name of the module is state, whichever shape of assignment binds it.
// `a, b = 0, 0` binds two names as surely as two lines would, and a click that
// writes them has to show on the page like a click that writes `plain`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import UnpackedState from './fixtures/UnpackedState.svelte';

test('names bound by unpacking follow their writes, as a plain name does', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(UnpackedState, { target });
    flushSync();

    const shown = () => target.querySelector('[data-k="shown"]').textContent;

    expect(shown()).toBe('0 0 0 0 0 0 0 2');

    target.querySelector('[data-k="bump"]').click();
    flushSync();

    // `c` and `e` are not written, and stay where they were.
    expect(shown()).toBe('1 1 1 0 1 0 1 3');
});
