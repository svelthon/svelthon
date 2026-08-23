import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Bound from './fixtures/Bound.svelte';

// A binding on a bare name, the simplest target there is: the value is compiled
// as an expression and as an assignment, and both are the same word. (A *prop* is
// a $derived, hence read-only — already Svelte's own rule for props that are not
// `$bindable`.) Other targets are in `bind-targets.test.js`.
describe('bind:', () => {
    const setup = () => {
        const t = document.body.appendChild(document.createElement('div'));
        mount(Bound, { target: t });
        return {
            input: t.querySelector('input[data-k="text"]'),
            echo: () => t.querySelector('p[data-k="echo"]').textContent,
            shout: () => {
                t.querySelector('button[data-k="shout"]').click();
                flushSync();
            }
        };
    };

    test('the initial value comes from Python', () => {
        const { input, echo } = setup();
        expect(input.value).toBe('ada');
        expect(echo()).toBe('ada/0');
    });

    test('typing travels up to Python', () => {
        const { input, echo, shout } = setup();

        input.value = 'grace';
        input.dispatchEvent(new window.Event('input', { bubbles: true }));
        flushSync();
        expect(echo()).toBe('grace/0');

        shout(); // name.upper() in Python, on the typed value
        expect(echo()).toBe('GRACE/0');
    });

    test('a Python write comes back down into the field', () => {
        const { input, shout } = setup();

        shout();
        expect(input.value).toBe('ADA');
    });
});
