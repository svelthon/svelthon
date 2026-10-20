// @vitest-environment node
//
// **The line a compiler refusal names, counted on the file the author is
// looking at.**
//
// `tests/refusal-position.test.js` asks this of the markup pass. Nothing asked
// it of the compiler, and a mutation sweep said so in the bluntest way: eight
// mutants of `compile.js` remove `+ lineOffset` from a position, or turn a
// computed line into `undefined`, and the suite stays green. A refusal that
// names the wrong line sends the author past the end of their own file, which
// is the failure this project has repaired twice in other places.
//
// `lineOffset` is the gap between the two counts: Python's line 1 is the first
// line of the `<script>` body, and the author's line 1 is the top of the file.
// Every case below is compiled with an offset, because an offset of zero is the
// one value that cannot tell a missing `+ lineOffset` from a correct one.
import { test, expect, describe } from 'vitest';
import { compile } from '../src/lib/compile.js';

const FILE = 'src/App.svelte';

// Four lines of markup before the block, which is what a real component has.
const OFFSET = 4;

const refuse = (body) => {
    try {
        compile(body, 'App', FILE, { lineOffset: OFFSET });
    } catch (error) {
        return error;
    }

    throw new Error(`\`${body.split('\n')[0]}\` was not refused`);
};

describe('a compiler refusal names the author’s line', () => {
    // Each body puts its fault on **Python line 3**, so the author's line is
    // 3 + 4 = 7 and one number checks both halves of the sum.
    test.for([
        ["a name with the compiler's prefix", 'a = 1\n\n__thing = 2\n'],
        ["one of Svelthon's own words", 'a = 1\n\ndef effect():\n    pass\n'],
        ['a JavaScript keyword', 'a = 1\n\ndelete = 4\n']
    ])('%s', ([, body]) => {
        const error = refuse(body);

        expect(error.message).toContain(`${FILE}:7`);
    });

    // A syntax error is Brython's, and the position has to be moved onto the
    // author's file the same way.
    test('a Python syntax error', () => {
        const error = refuse('a = 1\n\ndef (:\n');

        expect(error.message).toContain(`${FILE}:7`);
    });

    // A rune written inside a function rather than at the module level. Its
    // line comes from the AST rather than from the name table, which is the
    // other of the two routes a position takes through this file.
    test('a rune below the top level', () => {
        const error = refuse('def f():\n\n    x = derived(lambda: 1)\n');

        expect(error.message).toContain(`${FILE}:7`);
        expect(error.start?.line).toBe(7);
    });

    // `__all__` built rather than written out. Same route, a refusal of its
    // own, and it is the one written most recently — which is exactly when a
    // position stops being checked.
    test('an export list this file cannot read', () => {
        let error;

        try {
            compile('a = 1\n\n__all__ = ["a"] + ["b"]\n', 'M', FILE, {
                plain: true,
                lineOffset: OFFSET
            });
        } catch (thrown) {
            error = thrown;
        }

        expect(error.start?.line).toBe(7);
    });

    // The hint under an `IndentationError`: it names the line that starts at
    // column zero while the rest of the block is indented, which is what the
    // project's own four-space convention makes the commonest mistake.
    test('the line an indentation hint points at', () => {
        const error = refuse('    a = 1\n    b = 2\nc = 3\n');

        expect(error.message).toContain('line 7 starts at column zero');
    });

    // The half a terminal cannot use and an editor can: the same line, on the
    // error object, which is what puts the squiggle on the right row.
    test.for([
        ["a name with the compiler's prefix", 'a = 1\n\n__thing = 2\n'],
        ["one of Svelthon's own words", 'a = 1\n\ndef effect():\n    pass\n']
    ])('%s carries the line for a tool', ([, body]) => {
        const error = refuse(body);

        expect(error.filename).toBe(FILE);
        expect(error.start?.line).toBe(7);
    });

    // The offset is what a missing `+ lineOffset` hides, so the same fault is
    // compiled twice and the two answers have to differ by the offset.
    test('and the line moves with the offset, which is the whole of it', () => {
        const body = 'a = 1\n\n__thing = 2\n';
        let alone;

        try {
            compile(body, 'App', FILE, { lineOffset: 0 });
        } catch (error) {
            alone = error;
        }

        expect(alone.message).toContain(`${FILE}:3`);
        expect(refuse(body).message).toContain(`${FILE}:7`);
    });
});
