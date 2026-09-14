import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import NoSpaceBind from './fixtures/NoSpaceBind.svelte';

// The binding face of the door `tests/no-space-attribute.test.js` covers, in its
// own file because it is the **loud** one.
//
// Degraded, `title="y"bind:value={x}` becomes an ordinary attribute whose value
// is a call, and Svelte refuses to bind to anything but a name or a member. So
// the component stops compiling, and a fixture holding both faces would take the
// silent one down with it before a single test ran. Two files is what keeps the
// dead button visible when the rule is removed.
describe('a binding with no space before it', () => {
    test('still writes back', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(NoSpaceBind, { target });
        flushSync();

        const field = target.querySelector('input[data-k="tight_bind"]');

        expect(field.value).toBe('start');

        field.value = 'edited';
        field.dispatchEvent(new Event('input'));
        flushSync();

        expect(target.querySelector('p[data-k="typed"]').textContent).toBe('edited');
    });
});
