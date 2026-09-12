// @vitest-environment node
//
// The engine is a CommonJS file, so a bundler wraps it in a lazy initialiser and
// places the call where the binding is used, not where the import sits. Left to
// a neighbour's import order, that call lands after `boot.js` in a production
// server build and `$B.brython` is undefined: the site builds and answers 500.
//
// Nothing the suite runs can see that, because nothing here builds. What holds
// it is the shape of the graph, read as text: the file that starts the engine is
// the file that imports it.
import { test, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name) =>
    readFileSync(fileURLToPath(new URL(`../src/lib/${name}`, import.meta.url)), 'utf8');

describe('the engine is imported where it is started', () => {
    test('boot.js imports it', () => {
        expect(read('boot.js')).toMatch(/^import '\.\.\/\.\.\/vendor\/brython\.js';$/m);
    });

    test('and it is the file that calls brython()', () => {
        expect(read('boot.js')).toContain('$B.brython(');
    });

    // The import used to sit in `runtime.js`, two lines above `import
    // './boot.js'`, which reads as an order and is not one.
    test('runtime.js does not import it', () => {
        expect(read('runtime.js')).not.toContain("vendor/brython.js");
    });
});
