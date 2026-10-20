// @vitest-environment node
//
// Every sign of the dialect takes an expression to the end of the line, and the
// rewrite wraps what it took in parentheses — so a trailing comment commented
// out the closing one, and the author was told `'(' was never closed` about a
// parenthesis they never typed. Everything Python's own syntax carries accepted
// one; nothing of ours did.
//
// The READMEs teach the refused form in three places each, which is how it was
// found: by compiling the documentation rather than by reading the compiler.
import { test, expect, describe } from 'vitest';
import { compile } from '../src/lib/compile.js';

const script = (src) => compile(src, 'Probe', 'src/Probe.svelte').script;

describe('a trailing comment', () => {
    test.for([
        ['state', 'count = 0            # state: a value\n'],
        ['a prop', 'n: int = 0           # a prop, with a default\n'],
        ['a derived', 'count = 0\ndoubled => count * 2 # derived: a calculation\n'],
        ['an effect', 'count = 0\n=> print(count)      # an effect: it acts\n'],
        ['a bindable', 'value: str <=>       # bindable, no fallback\n'],
        ['a bindable with a fallback', 'value: str <=> "d"   # bindable, with one\n'],
        ['and inspect', 'count = 0\ninspect(count)       # a console.log that reruns\n']
    ])('is allowed after %s', ([, src]) => {
        expect(() => script(src)).not.toThrow();
    });

    // The scanner was never naive about comments — a `#` inside a string was
    // always safe. It was the capture that took everything to the end of the
    // line.
    test('while a # inside a string is not one', () => {
        // The Python itself lives in the module half, which is where the two
        // strings have to arrive whole.
        const { module } = compile('tag = "#gil"\nlabel => tag + "#py"\n', 'Probe', 'src/P.svelte');

        expect(module).toContain('#gil');
        expect(module).toContain('#py');
    });

    test('and the expression still has to finish on its line', () => {
        expect(() => script('count = 0\nd => (count *  # note\n')).toThrow(/must fit on one line/);
    });
});
