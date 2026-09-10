import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ArrowDerived from './fixtures/ArrowDerived.svelte';
import ArrowEffect from './fixtures/ArrowEffect.svelte';

// `doubled => count * 2` — a derived, written the way the state beside it is
// written. Naming is not required for state, since a bare assignment already
// says it; the argument for an operator rather than a word is that it is not
// required here either.
//
// `=>` is a SyntaxError in Python, so no valid source can hold one outside a
// string or comment, and the rewrite has no ambiguity to resolve: it becomes
// `x = derived(lambda: expr)` on the same line, which keeps every line number.
describe('the derived operator', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(ArrowDerived, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            bump: () => {
                target.querySelector('button[data-k="bump"]').click();
                flushSync();
            }
        };
    };

    test('reads as a value, not as a call', () => {
        expect(setup().read('doubled')).toBe('2');
    });

    test('and it recomputes', () => {
        const { read, bump } = setup();

        bump();
        expect(read('count')).toBe('2');
        expect(read('doubled')).toBe('4');
    });

    // The chain is the reason a derived is not just a function: each link is
    // computed at most once per change, in order.
    test('one derived feeds another', () => {
        const { read, bump } = setup();

        expect(read('quadrupled')).toBe('4');
        bump();
        expect(read('quadrupled')).toBe('8');
    });

    // The trap a text rewrite walks into if it does not track quoting.
    test('an arrow inside a string is left alone', () => {
        expect(setup().read('note')).toBe('x => y');
    });

    // `@derived` is the counterpart of Svelte's `$derived.by`, and stays.
    test('the decorator still works beside it', () => {
        const { read, bump } = setup();

        expect(read('described')).toBe('few');
        bump();
        bump();
        bump();
        expect(read('described')).toBe('many');
    });
});

// The same arrow with nothing to name. A derived and an effect re-run on the
// same signal and differ only in whether anyone keeps the answer — which is the
// line Python already draws without a symbol, between `x = f()` and `f()`.
//
// Svelte 4 wrote both `$:` and Svelte 5 split them, because a `$:` statement did
// not show whether it computed or acted. Here the difference is the first thing
// on the line, at the column where the eye looks for a name.
describe('the effect operator', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(ArrowEffect, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            seen: () => document.body.getAttribute('data-seen'),
            bump: () => {
                target.querySelector('button').click();
                flushSync();
            }
        };
    };

    test('it runs once on mount', () => {
        expect(setup().seen()).toBe('0');
    });

    test('and again whenever what it read has changed', () => {
        const { seen, bump } = setup();

        bump();
        expect(seen()).toBe('1');
        bump();
        expect(seen()).toBe('2');
    });

    // The two forms of the one operator, side by side in the same component.
    test('a named arrow beside it is still a derived', () => {
        const { read, bump } = setup();

        expect(read('doubled')).toBe('0');
        bump();
        expect(read('doubled')).toBe('2');
    });
});

