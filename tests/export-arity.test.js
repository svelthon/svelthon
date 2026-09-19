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

// And the signature is the **value's**, not the `def`'s.
//
// The count came off the AST of the `def` and was frozen in the adapter, which
// is a bet that a name still holds what it declared. A decorator is what makes
// that false, and `decorators are identity` is a rule written elsewhere in this
// project: `@collect def decorated(value)` answering a `*values` function had
// three arguments in Python, three under an alias, and **one** through its own
// export — two of them dropped before the decorator ever saw them.
//
// The alias path had neither defect, and it is the whole repair: it asks the
// value what it is and what it takes. Every row here compares the export against
// those two references rather than against a number written in the test.
describe('a name behind a decorator', () => {
    const mod = () => import('./fixtures/signatures_mod.py');

    // What a library reads off the export before calling it. The mutation
    // harness found this one: flipping the branch that reads it killed nothing,
    // so nothing was asserting the number a caller can see.
    test('and reports the signature it will accept', async () => {
        const m = await mod();

        expect(m.regular.length).toBe(2);
        expect(m.variadic.length).toBe(0);
        // Behind a decorator, it is the resulting callable's, not the `def`'s.
        expect(m.decorated.length).toBe(0);
    });

    test('is called with what Python would give it', async () => {
        const m = await mod();

        expect(m.decorated(10, 20, 30)).toBe(3);
        // The two references, which never disagreed with each other.
        expect(m.aliased(10, 20, 30)).toBe(3);
        expect(m.from_python()).toBe(3);
    });

    test('and is callable even when the decorator answers an instance', async () => {
        const m = await mod();

        // A callable instance is not a JavaScript function, and the emitted call
        // was a JavaScript call: *not a function*, for a value Python calls.
        expect(m.as_object_decorated(0.25)).toBe(0.5);
    });

    // The same question on the other wrapper — a component's `@export` — is in
    // `tests/exported.test.js`, which has a DOM to mount in.
    test('and a name rebound after init behaves as what it holds now', async () => {
        const m = await mod();

        expect(m.rebound(1, 2, 3)).toBe(1);

        m.rebind();

        // The body followed the rebinding already; the arguments did not.
        expect(m.rebound(1, 2, 3)).toBe(3);
    });
});
