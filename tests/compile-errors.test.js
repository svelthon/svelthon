// @vitest-environment node
//
// Build-time code: jsdom has no business here, and its null
// `document.currentScript` would break Brython's bootstrap.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

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

    // The line number is what a source map cannot recover on its own.
    test('and the line it happened on', () => {
        expect(failure('x = 1\ny = 2\nreturn 3')).toContain('probe.py:3');
    });

    // A parse error already worked, and still does.
    test('a parse error is unchanged', () => {
        expect(failure('def (:')).toContain('never closed');
    });
});
