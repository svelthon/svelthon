import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Arrow from './fixtures/Arrow.svelte';

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
        mount(Arrow, { target });
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

