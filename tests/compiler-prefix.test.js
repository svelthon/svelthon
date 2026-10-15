// @vitest-environment node
//
// The compiler builds six families of name out of the author's own — `__fn_x`,
// `__rev_x`, `__bump_x`, `__local_x`, `__js_x`, `__root_x` — and
// declares them in the same scope, beside `__proto`. A name of that shape
// therefore collides with one of them, and what the author saw was `Identifier
// '__fn_go' has already been declared`, at a line and column inside the emitted
// script, under a frame of three lines they never wrote.
//
// A prefix rather than a list, since a list cannot cover the family added next.
// And the trailing `__` is what makes it safe: every name Python itself puts in
// a module carries one.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');
const script = (src, options) => compile(src, 'Probe', 'src/Probe.svelte', options).script;

describe('the compiler’s own prefix', () => {
    test.for([
        ['a function', 'def __fn_go():\n    return 1\n'],
        ['a state name', '__rev_c = 0\n'],
        ['a prop', '__local_n: int = 0\n'],
        ['and the namespace itself', '__proto = 1\n']
    ])('%s is refused by name', ([, src]) => {
        expect(() => script(src)).toThrow(/starts with `__`, which is the compiler's own prefix/);
    });

    // The other half of the rule, and the reason it is safe: Python's own module
    // names all carry a trailing `__`.
    test.for([
        ['__all__', '__all__ = ["x"]\nx = 1\n'],
        ['__doc__', '__doc__ = "d"\n'],
        ['__js__', '__js__ = {"./m.js": ["f"]}\n']
    ])('%s is left alone', ([, src]) => {
        expect(() => script(src, { plain: true })).not.toThrow();
    });

    test('and an ordinary name is not a dunder at all', () => {
        expect(() => script('compteur = 0\n')).not.toThrow();
    });

    // The names the compiler itself writes into the source pass the rule by
    // their shape; written by the author, one would be replaced by the
    // compiler's own function of that name.
    test.for([
        ['a template expression', 'def __expr_0():\n    return 7\n'],
        ['an effect', '__effect_1 = 1\n'],
        ['an inspection', 'x = __inspect_0\n']
    ])('%s the compiler names is refused when the author writes it', ([, src]) => {
        expect(() => script(src)).toThrow(/is a name the compiler writes itself.*\(src\/Probe\.svelte:1\)/);
    });

    // A string or a comment holds no name, and an arrow is the compiler's own.
    test('and not in a string, a comment or an arrow', () => {
        expect(() => script('x = "__expr_0"  # __effect_1\n=> print(x)\n')).not.toThrow();
    });
});
