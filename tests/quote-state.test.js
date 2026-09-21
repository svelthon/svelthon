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
import { createRequire } from 'node:module';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

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
