// @vitest-environment node
//
// The other half of `tests/refusal-position.test.js`, which holds the markup
// pass. A refusal has to be clickable, and that is a field rather than a
// sentence: `vite-plugin-svelte` builds `rollupError.loc` only `if
// (error.start)`, and `loc` is what the dev overlay highlights and what an
// editor jumps to (`src/utils/error.js`, `toRollupError`). It sets `id` from
// `filename` whatever happens.
//
// Measured on 2026-09-13: the markup pass had been setting `filename`, `start`
// and `end` since the file next door was written, and `compile.cjs` threw
// sixteen `SyntaxError`s with none of them. One compiler, and a mistake in the
// markup got a squiggle while a mistake in the script got a line of console
// text.
//
// The line is what these refusals know; there is no column, because they read a
// line at a time where `walk()` reads a character at a time. The ones that read
// a list of declared names rather than a line carry the file alone, and say so
// by having no `start` rather than a wrong one.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compile } = require('../src/lib/compile.cjs');

const FILE = 'src/P.svelte';

const thrown = (source, options = {}) => {
    try {
        compile(source, 'P', FILE, options);
    } catch (error) {
        return error;
    }

    throw new Error('nothing was refused');
};

describe('a compiler refusal names a position', () => {
    test.for([
        ['an indented `=>`', 'x = 1\ndef go():\n    d => 2\n', {}, 3],
        ['`=>` in a .py', 'd => 2\n', { plain: true }, 1],
        ['`<=>` in a .py', 'v: str <=> "a"\n', { plain: true }, 1],
        ['a misspelled importjs', 'importjs oops\n', {}, 1],
        ['importjs in a .py', 'importjs {a} from "m"\n', { plain: true }, 1],
        ['a rune inside a def', 'def go():\n    n = inspect(1)\n', {}, 2]
    ])('%s', ([, source, options, line]) => {
        const error = thrown(source, options);

        expect(error.message).toMatch(/^svelthon — /);
        expect(error.filename).toBe(FILE);
        expect(error.start).toEqual({ line, column: 0 });
        expect(error.end).toEqual({ line, column: 0 });
    });

    test.for([
        ['a locked word', 'def effect():\n    pass\n', {}],
        ['`__all__` naming what is not bound', '__all__ = ["nope"]\n', { plain: true }]
    ])('%s names the file and no line', ([, source, options]) => {
        const error = thrown(source, options);

        expect(error.message).toMatch(/^svelthon — /);
        expect(error.filename).toBe(FILE);
        expect(error.start).toBeUndefined();
    });

    // And Brython's own errors, which is the refusal an author meets most.
    test('a Python syntax error carries the line Brython reported', () => {
        const error = thrown('x = (\n');

        expect(error.filename).toBe(FILE);
        expect(error.start.line).toBeGreaterThan(0);
    });
});
