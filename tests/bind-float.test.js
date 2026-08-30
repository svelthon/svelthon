import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import BindFloat from './fixtures/BindFloat.svelte';

// A binding is the one place a Python value reaches the DOM unconverted, and a
// Brython float is an object rather than a number. Every input below used to
// read it wrong, each in its own way.
describe('a float across a binding', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(BindFloat, { target });
        flushSync();
        return (k) => target.querySelector(`[data-k="${k}"]`);
    };

    test('a range reads it instead of falling back to the middle of its scale', () =>
        expect(setup()('range').value).toBe('0.1'));

    test('a number field reads it instead of staying empty', () =>
        expect(setup()('number').value).toBe('0.1'));

    test('a text field reads it instead of showing [object Object]', () =>
        expect(setup()('text').value).toBe('0.1'));

    test('an int was never affected', () => expect(setup()('int').value).toBe('1'));

    // What `08-motion/01-spring` writes: the target is a member of a JavaScript
    // object rather than a module-level name.
    test('and a member of a JavaScript object reads the same way', () =>
        expect(setup()('member').value).toBe('0.25'));

    // The other direction was never broken, and has to stay that way.
    test('writing still reaches Python', () => {
        const at = setup();
        const input = at('range');
        input.value = '0.42';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
        expect(at('back').textContent).toBe('0.42');
    });
});
