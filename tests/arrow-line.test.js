// @vitest-environment node
//
// The dialect's arrow takes the rest of its line — `total => a + b` — and two
// scanners decide where that line ends.
//
// **`commentAt`** says where a trailing `#` starts, because everything Python's
// own syntax carries accepts a trailing comment and every sign of ours refused
// one: the rewrite wrapped what the sign took in parentheses, so a `#` commented
// the closing one out and the author was told `'(' was never closed` about a
// parenthesis they never typed.
//
// **`balanced`** says whether the expression finishes there at all: a `(` left
// open would swallow the lines under it into a lambda, and Brython would report
// a mismatched bracket several lines down, which says nothing about what to do.
//
// A mutation sweep leaves seven of their decisions standing, because the tests
// that exist write an arrow and a comment and never a `#` *inside* something.
// Each row below puts one where it must not be read as a comment.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

const build = (body) => compile(body, 'App', 'src/App.svelte');

describe('an arrow reads to the end of its line', () => {
    // The `#` is not a comment here, so the expression keeps it and the line is
    // still balanced. Reading it as one would cut the expression short, and the
    // generated lambda says which happened.
    test.for([
        ['a single-quoted hash', "total => '#'"],
        ['a double-quoted hash', 'total => "#"'],
        ['a hash inside a longer string', 'total => "a # b"'],
        ['a triple-quoted hash', 'total => """a # b"""'],
        ["the other fence", "total => '''a # b'''"],
        ['an escaped quote before it', 'total => "a\\" # b"'],
        ['a hash in a dict key', 'total => {"#": 1}["#"]']
    ])('%s is not a comment', ([, body]) => {
        // The Python lands in the virtual module, not in the wrapper the
        // component imports: the wrapper is the same text whatever the body
        // says, so reading it would prove nothing.
        const { module } = build(`${body}\n`);

        expect(module).toContain('#');
    });

    // And the other half: a real trailing comment is taken off, so the sign may
    // carry one the way every other line of Python does.
    test.for([
        ['after a name', 'total => a  # why'],
        ['after a string', 'total => "x"  # why'],
        ['after a call', 'total => len("ab")  # why'],
        // The row that says the scan comes back out of a triple-quoted string
        // and keeps looking: landing anywhere but past the closing fence leaves
        // the comment in the expression, and the rewrite's own parenthesis is
        // then commented out.
        ['after a triple-quoted string', 'total => """x"""  # why']
    ])('%s is a comment and is cut', ([, body]) => {
        expect(() => build(`a = 1\n${body}\n`)).not.toThrow();
    });

    // `balanced` is the other decision on the same line. An expression that does
    // not finish is refused *here*, naming the line, rather than by Brython
    // several lines down.
    test.for([
        ['an open parenthesis', 'total => (1 +'],
        ['an open bracket', 'total => [1,'],
        ['an open brace', 'total => {1:'],
        ['a backslash at the end', 'total => 1 + \\'],
        ['a backslash after an effect', '=> print(1) or \\']
    ])('%s is refused on its own line', ([, body]) => {
        expect(() => build(`${body}\n    2\n`)).toThrow(/must fit on one line; use @\w+ on a def for anything longer \(src\/App\.svelte:1\)/);
    });
    // A bracket inside a string closes nothing, so this one fits.
    test('a bracket inside a string does not leave the line open', () => {
        expect(() => build('total => "(" + ")"\n')).not.toThrow();
    });
});
