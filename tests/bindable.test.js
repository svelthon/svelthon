import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import BindHost from './fixtures/BindHost.svelte';

// An annotation whose value is a call to bindable() declares a two-way prop:
//     value: str = bindable()   /   tag: str = bindable("default")
//
// The trap: the module body applies the default by writing to the name, and
// that particular write must not travel up to the parent. Only the ones that
// follow init() are real writes.
describe('bindable', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(BindHost, { target });
        flushSync();
        return {
            read: (sel) => target.querySelector(sel).textContent,
            click: (sel) => {
                target.querySelector(sel).click();
                flushSync();
            }
        };
    };

    test('the parent’s value comes down', () => {
        const { read } = setup();

        expect(read('[data-k="parent"]')).toBe('hello');
        expect(read('[data-k="bound"] [data-k="value"]')).toBe('hello');
    });

    test('a Python write in the child travels up to the parent', () => {
        const { read, click } = setup();

        click('[data-k="bound"] button');
        expect(read('[data-k="parent"]')).toBe('HELLO');
    });

    test('a write from the parent comes back down', () => {
        const { read, click } = setup();

        click('button[data-k="reset"]');
        expect(read('[data-k="bound"] [data-k="value"]')).toBe('reset');
    });

    test('the default applies without overwriting the parent', () => {
        const { read } = setup();

        // The default holds for both instances: the parent binds `value` only.
        expect(read('[data-k="unbound"] [data-k="tag"]')).toBe('default');
        expect(read('[data-k="bound"] [data-k="tag"]')).toBe('default');
    });

    test('an unbound instance stays independent', () => {
        const { read, click } = setup();

        click('[data-k="bound"] button');
        // A prop that was not supplied is None, like an ordinary prop, and a
        // template renders None as nothing — so the unbound instance shows an
        // empty cell while the bound one shows what the click set.
        expect(read('[data-k="unbound"] [data-k="value"]')).toBe('');
    });
});
