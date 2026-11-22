// @vitest-environment node
//
// The compiler names everything it writes beside the author's names with one
// prefix, `__brycomp_`: the families it builds out of a name, `__brycomp_fn_x`,
// `__brycomp_rev_x`, `__brycomp_bump_x`, and the rest, `__brycomp_proto`,
// `__brycomp_text`, declared in the same scope. A name of the author's with that
// prefix collides with one of them, and what the author saw was `Identifier
// '__brycomp_fn_go' has already been declared`, at a line and column inside the
// emitted script, under a frame of three lines they never wrote.
//
// A prefix rather than a list, since a list cannot cover the family added next,
// and one no author writes: every other name is the author's, `__cache` too.
import { test, expect, describe } from 'vitest';
import { compile } from '../src/lib/compile.js';

const script = (src, options) => compile(src, 'Probe', 'src/Probe.svelte', options).script;

describe('the compiler’s own prefix', () => {
    test.for([
        ['a function', 'def __brycomp_fn_go():\n    return 1\n'],
        ['a state name', '__brycomp_rev_c = 0\n'],
        ['a prop', '__brycomp_local_n: int = 0\n'],
        ['and the namespace itself', '__brycomp_proto = 1\n']
    ])('%s is refused by name', ([, src]) => {
        expect(() => script(src)).toThrow(/starts with `__brycomp_`, which is the compiler's own prefix/);
    });

    // The other half of the rule: Python's own module names, and every name of
    // the author's without the prefix, `__` in front or not.
    test.for([
        ['__all__', '__all__ = ["x"]\nx = 1\n'],
        ['__doc__', '__doc__ = "d"\n'],
        ['__js__', '__js__ = {"./m.js": ["f"]}\n'],
        ['__cache', '__cache = {}\n'],
        ['__helper', 'def __helper():\n    return 1\n'],
        ['__fn_go', 'def __fn_go():\n    return 1\n']
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
        ['a template expression', 'def __brycomp_expr_0():\n    return 7\n'],
        ['an effect', '__brycomp_effect_1 = 1\n'],
        ['an inspection', 'x = __brycomp_inspect_0\n']
    ])('%s the compiler names is refused when the author writes it', ([, src]) => {
        expect(() => script(src)).toThrow(/is a name the compiler writes itself.*\(src\/Probe\.svelte:1\)/);
    });

    // A string or a comment holds no name, and an arrow is the compiler's own.
    test('and not in a string, a comment or an arrow', () => {
        expect(() => script('x = "__brycomp_expr_0"  # __brycomp_effect_1\n=> print(x)\n')).not.toThrow();
    });
});
