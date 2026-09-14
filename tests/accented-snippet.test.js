import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import AccentedSnippet from './fixtures/AccentedSnippet.svelte';

// The one face of the ASCII-name class that rendered a wrong value instead of
// failing: `\w+` cannot end immediately before the `(`, so `{#snippet ligné(x)}`
// lost its parameter list. The body still resolved `x`, to the module-level name
// of the same spelling, so the snippet rendered, and rendered something else.
//
// A fixture rather than a string comparison, because the point is the value a
// reader sees on the page. The module name is deliberately spelled like the
// parameter: that is what makes a lost parameter a wrong answer rather than a
// NameError.
describe('a snippet whose name carries an accent', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(AccentedSnippet, { target });
        flushSync();

        return (k) => target.querySelector(`i[data-k="${k}"]`).textContent;
    };

    test('receives its argument, as its ASCII twin does', () => {
        const read = setup();

        expect(read('ascii')).toBe('PARAM');
        expect(read('accent')).toBe('PARAM');
    });

    test('rather than the module name it would otherwise read', () => {
        expect(setup()('accent')).not.toBe('MODULE');
    });
});
