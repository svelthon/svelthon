// A component a snippet's parameter holds is the one it is handed, whatever a
// name of that spelling imports: a JavaScript child reached that way is handed
// JavaScript's own values, as it is when written by its own name.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ShadowedChildParent from './fixtures/ShadowedChildParent.svelte';

test('a snippet parameter that shadows an imported Python child hands a JavaScript child its own values', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ShadowedChildParent, { target });
    flushSync();

    const read = (kind) => target.querySelector(`[data-k="${kind}"]`).textContent;

    for (const kind of ['named', 'short', 'spread', 'bound']) expect(read(kind)).toBe('number|0.25');
});
