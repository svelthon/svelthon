// @vitest-environment node
//
// The parsing chain is a contiguous run of Brython's own scripts, and each one
// is a complete `(function($B){…})(__BRYTHON__)`. So the block stands alone: a
// page loads the engine without it, and a route that compiles loads it after,
// onto the engine already there.
//
// That is what makes the size work decidable at build time rather than by a
// flag: a site ships `brython_runtime.js`, and only what compiles pays for
// `brython_compiler.js`.
//
// This file loads the two vendored halves directly rather than through
// `src/lib/runtime.js`, which pulls the whole engine.
import { test, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';

describe('the parsing chain loads onto a running engine', () => {
    test('the runtime half has no parser, and gains one', async () => {
        await import('../src/lib/globals.js');
        await import('../vendor/brython_runtime.js');

        const $B = globalThis.__BRYTHON__;
        expect(typeof $B.Parser).toBe('undefined');

        // Indirect eval: the block is a script, not a module, and this is what
        // a plugin would do with it.
        (0, eval)(readFileSync('vendor/brython_compiler.js', 'utf8'));

        expect(typeof $B.Parser).toBe('function');
    });

    // The point of the exercise: not that a name appears, but that the engine
    // compiles Python afterwards.
    test('and Python compiles through it', () => {
        const $B = globalThis.__BRYTHON__;
        const js = $B.py2js('x = 1 + 1\n', 'probe', 'probe').to_js();

        expect(js).toContain("$B.namespace(");
        expect(js.length).toBeGreaterThan(100);
    });
});
