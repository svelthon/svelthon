import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ArrowDerived from './fixtures/ArrowDerived.svelte';
import ArrowEffect from './fixtures/ArrowEffect.svelte';
import ArrowTuple from './fixtures/ArrowTuple.svelte';
import { createRequire } from 'node:module';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

// The right-hand side of an arrow reads as the right-hand side of `=` reads:
// a comma makes a tuple. Wrapped bare in the lambda, `pair => a, b` handed `b`
// to the marker as a second argument and kept `1`, `size: tuple <=> 3, 4`
// defaulted to `3`, and the effect `=> f(a), g(a)` ran `g(a)` once, outside it.
describe('an arrow whose right-hand side holds a comma', () => {
    test('is the tuple `=` would give, and so is a bindable default', () => {
        globalThis.arrowTupleLog = [];
        const target = document.body.appendChild(document.createElement('div'));
        mount(ArrowTuple, { target });
        flushSync();

        const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;

        expect(read('pair')).toBe(read('assigned'));
        expect(read('pair')).toBe('(1, 2)');
        expect(read('size')).toBe('(3, 4)');

        // The template's braces hold a Python expression the same way: its
        // wrapper took `{a, b}` as two arguments and showed `1`.
        expect(read('template')).toBe(read('assigned'));

        target.querySelector('button').click();
        flushSync();

        expect(read('pair')).toBe('(2, 2)');
    });

    test('and an effect runs every call of its tuple, each time', () => {
        globalThis.arrowTupleLog = [];
        const target = document.body.appendChild(document.createElement('div'));
        mount(ArrowTuple, { target });
        flushSync();

        target.querySelector('button').click();
        flushSync();

        expect(globalThis.arrowTupleLog).toEqual(['first 1', 'second 1', 'first 2', 'second 2']);
    });

    // `:=` inside the arrow would bind in the lambda the arrow becomes, not in
    // the module where `=` binds.
    test('while a walrus inside an arrow is refused, on its line', () => {
        expect(() => compile('count = 1\ndoubled => (half := count) * 2\n', 'Probe', 'src/Probe.svelte')).toThrow(
            /`half :=` inside `=>` would bind `half` in the lambda the derived becomes.*\(src\/Probe\.svelte:2\)/
        );
        expect(() => compile('count = 1\n=> print(seen := count)\n', 'Probe', 'src/Probe.svelte')).toThrow(
            /`seen :=` inside `=>` would bind `seen` in the lambda the effect becomes/
        );
        expect(() => compile('count = 1\nlabel => f"{count}:="\n', 'Probe', 'src/Probe.svelte')).not.toThrow();
    });

    // Read off the expression's AST, not its text: a walrus in an f-string's
    // field binds in the lambda all the same, and one in a lambda of its own
    // binds there, which is what Python does with it anyway.
    test('a walrus in an f-string field is refused, one in an inner lambda is not', () => {
        expect(() => compile('count = 1\nlabel => f"{(half := count)}"\n', 'Probe', 'src/Probe.svelte')).toThrow(
            /`half :=` inside `=>`/
        );
        expect(() =>
            compile('count = 1\nwrapped => (lambda: (inner := count))()\n', 'Probe', 'src/Probe.svelte')
        ).not.toThrow();
    });
});

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

