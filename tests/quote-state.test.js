// @vitest-environment node
//
// **What is a string, read a line at a time.**
//
// `importjs` is lifted out of the source before Brython sees it, and the lift
// walks lines: only a triple-quoted string survives a line break, so it is the
// only thing that can hide an `importjs` further down — the trap a regex over
// the whole source walks straight into.
//
// The scanner that tracks it is the least exercised code in the project: a
// mutation sweep leaves eight of its decisions standing, including the one that
// **closes** a triple quote. Nothing said so because every test wrote its
// `importjs` in a file with no docstring in it.
//
// The two answers are opposite and both visible, which is what makes this
// testable at all: an indented `importjs` is refused, and one at the start of a
// line is taken. So each row below says which of the two it expects, and a
// scanner that loses the thread gives the other.
import { test, expect, describe } from 'vitest';
import { compile } from '../src/lib/compile.js';

const build = (body) => compile(body, 'App', 'src/App.svelte');

const TAKEN = 'importjs fly from "svelte/transition"\n';
const HIDDEN = '    importjs ghost from "nowhere"\n';

describe('a triple-quoted string hides what is inside it', () => {
    test.for([
        ['a docstring spanning lines', `"""doc\n${HIDDEN}"""\n${TAKEN}`],
        ['the other fence', `'''doc\n${HIDDEN}'''\n${TAKEN}`],
        ['two of them', `"""a\n${HIDDEN}"""\n'''b\n${HIDDEN}'''\n${TAKEN}`],
        // A backslash inside the string, which the scanner steps over.
        ['one holding an escape', `"""a\\"""b\n${HIDDEN}"""\n${TAKEN}`]
    ])('%s', ([, body]) => {
        const { script } = build(body);

        expect(script).toContain('svelte/transition');
        expect(script).not.toContain('nowhere');
    });

    // The half that says the scanner comes back out: a fence that closes, and
    // an indented `importjs` after it, which is refused because it is code.
    test.for([
        ['a docstring that closes on a later line', `"""doc\n"""\n${HIDDEN}`],
        ['one that opens and closes on one line', `a = """doc"""\n${HIDDEN}`],
        ['a single-quoted string holding a fence', `a = '"""'\n${HIDDEN}`],
        ['a double-quoted string holding an escape', `a = "\\""\n${HIDDEN}`],
        ['a comment holding a fence', `a = 1  # """\n${HIDDEN}`],
        // The control, and it needs the line above it: a block that is indented
        // *throughout* is unindented first, which is the project's own
        // four-space convention, so a lone indented line is not indented at all
        // by the time this runs.
        ['nothing at all', `a = 1\n${HIDDEN}`]
    ])('%s leaves the code after it code', ([, body]) => {
        expect(() => build(body)).toThrow(/importjs must start the line/);
    });
});

// The dialect's signs are read by the same rule as the markup's scanners,
// `atomic`, and its grammar is Python's: a field that reuses its f-string's
// quote, and a lone quote inside a triple-quoted string. Read by a quote
// scanner of the compiler's own, each ended a string early: a `=>` that fits on
// its line was refused as not fitting, and one on the line after such a string
// reached Brython as `invalid syntax`.
describe("the signs read Python's strings", () => {
    test.for([
        ['an f-string whose field reuses its quote', 'total = 1\nlabel => f"{"("}{total}"\n'],
        ['a triple-quoted string holding a lone quote', 'total = 1\nlabel => """a "(" b""" + str(total)\n'],
        ['a `=>` after a line holding such an f-string', 'note = f"{"("}"\ntotal = 1\nlabel => total * 2\n']
    ])('%s', ([, body]) => {
        expect(build(body).script).toContain("'label'");
    });

    // `inspect_with(logger, *values)` is split where Python's parser ends the
    // logger. It was split at the first comma outside a string, and a lambda of
    // two parameters has one between them, as an f-string's field may: the
    // halves made no Python.
    test('the logger of `inspect_with` is read as Python reads it', () => {
        expect(() =>
            build('total = 1\ninspect_with(lambda kind, *values: print(f"{", "}", kind), total)\n')
        ).not.toThrow();
    });

    // And the line state: a field holding a fence inside a string of its own is
    // not the end of the triple-quoted f-string around it, so the lines under it
    // are still the string's, and the `importjs` after its real end is code.
    test('a fence inside a field does not close the f-string around it', () => {
        const { script } = build(`doc = f"""{'"""'}\n${HIDDEN}"""\n${TAKEN}`);

        expect(script).toContain('svelte/transition');
        expect(script).not.toContain('nowhere');
    });
});
