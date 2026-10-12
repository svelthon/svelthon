// A component a snippet's parameter holds is the one it is handed, whatever a
// name of that spelling imports: a JavaScript child reached that way is handed
// JavaScript's own values, and a Python child the Python values, as each is
// when written by its own name.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ShadowedChildParent from './fixtures/ShadowedChildParent.svelte';

test('a snippet parameter hands each child the values of its language', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ShadowedChildParent, { target });
    flushSync();

    const read = (child, kind) => target.querySelector(`[data-r="${child}"] [data-k="${kind}"]`).textContent;

    for (const kind of ['named', 'short', 'spread', 'bound']) {
        expect(read('native', kind)).toBe('number|15');
        expect(read('python', kind)).toBe('float|15.0');
    }
});
