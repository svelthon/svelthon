// @vitest-environment node
//
// What a JavaScript caller may hand a Python function, read off its signature.
//
// It was `args.args.length`, which is only the middle third of a positional
// signature. `def positional(x, /, y)` puts `x` in `posonlyargs`, so the wrapper
// passed one argument and Python raised about a missing one; `def variadic(*v)`
// has no `args` at all, so `variadic(2, 3)` answered **0** and nothing was
// raised to say the arguments had been dropped.
//
// Truncation exists to keep a DOM event object out of a handler that never asked
// for one. Reusing that policy for a function an application calls on purpose is
// what produced the silent case, and the outside reading that found this said so
// in as many words.
import { test, expect, describe } from 'vitest';

describe('a module export keeps the arguments its signature accepts', () => {
    const mod = () => import('./fixtures/signatures_mod.py');

    test('ordinary positional parameters', async () => {
        expect((await mod()).regular(2, 3)).toBe(5);
    });

    // `x` lives in `posonlyargs`, which the count never looked at.
    test('a positional-only parameter is still a parameter', async () => {
        expect((await mod()).positional(2, 3)).toBe(5);
    });

    // The silent one: no exception, a wrong answer.
    test('and `*args` takes everything it was given', async () => {
        const m = await mod();

        expect(m.variadic(2, 3)).toBe(2);
        expect(m.variadic()).toBe(0);
        expect(m.variadic(1, 2, 3, 4)).toBe(4);
    });

    // A default is not a different arity: the caller may fill it or not.
    test('a default is still fillable from JavaScript', async () => {
        const m = await mod();

        expect(m.defaulted(2)).toBe(12);
        expect(m.defaulted(2, 3)).toBe(5);
    });
});
