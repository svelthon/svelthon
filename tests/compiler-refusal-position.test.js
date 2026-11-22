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
// and `end` since the file next door was written, and `compile.js` threw
// sixteen `SyntaxError`s with none of them. One compiler, and a mistake in the
// markup got a squiggle while a mistake in the script got a line of console
// text.
//
// The line is what these refusals know; there is no column, because they read a
// line at a time where `walk()` reads a character at a time. The ones that read
// a list of declared names rather than a line carry the file alone, and say so
// by having no `start` rather than a wrong one.
import { test, expect, describe } from 'vitest';
import { parse } from 'svelte/compiler';
import { compile } from '../src/lib/compile.js';

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
        ['a rune inside a def', 'def go():\n    n = inspect(1)\n', {}, 2],
        // `surface()` records where each name was bound, which is what lets this
        // one point at the `def` that took the word.
        ['a locked word', 'x = 1\ndef effect():\n    pass\n', {}, 2],
        // The local name of a JavaScript import is a binding of the generated
        // module, held to the rules every binding there is: these used to reach
        // the JavaScript parser downstream, which named no line of the author's.
        ['a __js__ name JavaScript reserves', 'x = 1\n__js__ = {"./m.js": ["new"]}\n', { plain: true }, 2],
        ['a __js__ name in the compiler prefix', '__js__ = {"./m.js": ["__brycomp_py"]}\n', { plain: true }, 1],
        ['an importjs default JavaScript reserves', 'x = 1\nimportjs default from "m"\n', {}, 2],
        ['an importjs renamed to a reserved word', 'importjs {a as new} from "m"\n', {}, 1],
        ['an importjs namespace in the compiler prefix', 'importjs * as __brycomp_py from "m"\n', {}, 1],
        ['an importjs naming `default` without renaming it', 'importjs {default} from "m"\n', {}, 1]
    ])('%s', ([, source, options, line]) => {
        const error = thrown(source, options);

        expect(error.message).toMatch(/^svelthon — /);
        expect(error.filename).toBe(FILE);
        expect(error.start).toEqual({ line, column: 0 });
        expect(error.end).toEqual({ line, column: 0 });
    });

    // What the rule lets through still makes a module that parses: the word a
    // foreign module exports may be reserved as long as the name it is bound to
    // is not, and a dunder is Python's, not the compiler's.
    test.for([
        ['importjs {default as player} from "m"\nx = player\n', {}],
        ['__js__ = {"./m.js": ["normal", "__version__"]}\ndef f():\n    return normal\n', { plain: true }]
    ])('accepted, and parses: %s', ([source, options]) => {
        const result = compile(source, 'P', FILE, options);

        expect(() => parse(`<script>${result.script}</script>`)).not.toThrow();
    });

    // `__all__` names something the module never bound, so there is no binding
    // to point at, and the line is the one `__all__` itself is on. The last one,
    // since that is the value the module ends up with.
    test('`__all__` naming what is not bound points at the list', () => {
        const error = thrown('x = 1\n__all__ = ["x"]\n__all__ = ["nope"]\n', { plain: true });

        expect(error.message).toMatch(/^svelthon — .*:3\)/);
        expect(error.filename).toBe(FILE);
        expect(error.start).toEqual({ line: 3, column: 0 });
    });

    // And an `@effect` a module cannot hold points at its function.
    test('an orphan @effect points at its def', () => {
        const error = thrown('x = 1\n\n@effect\ndef watch():\n    print(x)\n', { store: true });

        expect(error.message).toMatch(/`@effect` belongs to a component.*:4\)/);
        expect(error.filename).toBe(FILE);
        expect(error.start).toEqual({ line: 4, column: 0 });
    });

    // And Brython's own errors, which is the refusal an author meets most.
    test('a Python syntax error carries the line Brython reported', () => {
        const error = thrown('x = (\n');

        expect(error.filename).toBe(FILE);
        expect(error.start.line).toBeGreaterThan(0);
    });

    // A component's Python starts below its opening `<script>`, so every line
    // above counts from the file and not from the block. Getting this wrong
    // points an editor at a line the author never wrote, which is worse than
    // pointing at nothing.
    test.for([
        ['a refusal of ours', 'd => 2\n', { plain: true, lineOffset: 5 }, 6],
        ['a refusal of Brython\'s', 'x = (\n', { lineOffset: 10 }, 11]
    ])('%s counts from the top of the file', ([, source, options, line]) => {
        expect(thrown(source, options).start.line).toBe(line);
    });
});
