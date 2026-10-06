// @vitest-environment node
//
// The source path travels into the generated JavaScript as a string literal: the
// namespace Brython opens, the frame it pushes, `__file__`, `__name__`, and the
// `withNamespace` wrapper this project writes around them. Pasted between
// quotes, a path holding one of those quotes closed the literal and the module
// stopped parsing — `src/O'Brien.svelte` is a legal filename, and the Python
// inside it was perfectly valid.
//
// Both sides had it: two literals here and the module's own in Brython's
// codegen, and every def, lambda, class and comprehension writes the name again
// in its own. The body compiled below has one of each. The vendored build
// carries the upstream commits.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compile } = require('../src/lib/compile.cjs');

describe('a quote in the source path', () => {
    // Imports and `export` are stripped so the body can be handed to
    // `new Function`, which parses a module body but not its imports. The
    // control path goes through exactly the same treatment.
    const parses = (source) => {
        const out = compile('def f():\n    return [x for x in (lambda: "ab")()]\n\nclass K:\n    y: int = 1\n', 'Probe', source);

        for (const half of ['script', 'module']) {
            const body = out[half].replace(/^import .*$/gm, '').replace(/^export /gm, '');

            new Function(body);
        }

        return true;
    };

    test('an ordinary path compiles to JavaScript that parses', () => {
        expect(parses('src/Normal.svelte')).toBe(true);
    });

    test('an apostrophe in the file name', () => {
        expect(parses("src/O'Brien.svelte")).toBe(true);
    });

    test('an apostrophe in a parent directory', () => {
        expect(parses("src/Jean's app/Page.svelte")).toBe(true);
    });

    test('a double quote, which is a legal character too', () => {
        expect(parses('src/say "hi".svelte')).toBe(true);
    });

    test('and a backslash, which escapes whatever follows it', () => {
        expect(parses('src/back\\slash.svelte')).toBe(true);
    });
});
