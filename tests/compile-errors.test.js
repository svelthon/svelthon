// @vitest-environment node
//
// Build-time code: jsdom has no business here, and its null
// `document.currentScript` would break Brython's bootstrap.
import { test, expect, describe } from 'vitest';
import { compile } from '../src/lib/compile.js';

// Brython quotes the offending line by reading the source back out of
// `$B.file_cache`, and `compiler_error` does it without checking the entry
// exists. A filename it has never seen turns every *compile* error — as opposed
// to a parse error, which takes another path — into a TypeError about `.split`
// on undefined, which names neither the mistake nor the line.
//
// These are the mistakes a beginner makes, so the message is the feature.
describe('compile errors carry Python’s own message', () => {
    const failure = (src) => {
        try {
            compile(src, 'Probe', 'probe.py', { plain: true });
        } catch (error) {
            return error.message;
        }

        throw new Error('expected a SyntaxError');
    };

    test.for([
        ['x = await f()', "'await' outside function"],
        ['return 1', "'return' outside function"],
        ['yield 1', "'yield' outside function"],
        ['break', "'break' outside loop"],
        ['continue', "'continue' not properly in loop"]
    ])('%s', ([src, expected]) => {
        expect(failure(src)).toContain(expected);
    });

    // Brython failing in its own JavaScript, rather than raising a Python
    // exception, arrived as the bare JavaScript error, naming no file. Brackets
    // nested just below the tokenizer's limit of 200 still recurse past the
    // parser's stack.
    test('and a failure of Brython s own code still says which file', () => {
        const nested = failure(`x = ${'['.repeat(199)}${']'.repeat(199)}`);

        expect(nested).toContain('Brython could not compile this file: RangeError');
        expect(nested).toContain('(probe.py)');
    });

    // The line number is what a source map cannot recover on its own.
    test('and the line it happened on', () => {
        expect(failure('x = 1\ny = 2\nreturn 3')).toContain('probe.py:3');
    });

    // A parse error already worked, and still does.
    test('a parse error is unchanged', () => {
        expect(failure('def (:')).toContain('never closed');
    });
});

// A `<script>` body sits inside markup and every Svelte example indents it one
// level, so `$B.unindent` removes that level before Brython ever sees it. Its
// rule bails as soon as one non-blank line is already at column zero — which in
// a component is a line typed without its neighbours' indentation. Refusing it is
// right; what was missing is the sentence saying which line, since Brython blames
// the first line of the block instead, one the author never touched.
describe('a line typed at column zero in a component', () => {
    const failure = (src) => {
        try {
            compile(src, 'App', 'App.svelte', { component: true });
        } catch (error) {
            return error.message;
        }

        return 'compiled';
    };

    test('is named, rather than blamed on the line above it', () => {
        const message = failure('    name = "world"\nc = 0\n');

        expect(message).toContain('IndentationError');
        expect(message).toContain('line 2 starts at column zero');
    });

    test.for([
        ['indented throughout', '    name = "world"\n    c = 0\n'],
        ['tabs throughout', '\tname = "world"\n\tc = 0\n'],
        ['flat throughout', 'name = "world"\nc = 0\n'],
        ['a nested block, written flat', 'name = "world"\nif True:\n    c = 0\n']
    ])('a block %s compiles', ([, src]) => expect(failure(src)).toBe('compiled'));

    // Nothing is at column zero here, so there is no such line to name and the
    // hint stays out of the way.
    test('a real indentation mistake keeps Python’s message alone', () => {
        const message = failure('    name = "world"\n        c = 0\n');

        expect(message).toContain('IndentationError');
        expect(message).not.toContain('column zero');
    });
});
