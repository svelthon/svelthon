// @vitest-environment node
//
// The engine is a CommonJS file, so a bundler wraps it in a lazy initialiser and
// places the call where the binding is used, not where the import sits. Left to
// a neighbour's import order, that call lands after the module that starts the
// engine in a production server build and `$B.brython` is undefined: the site
// builds and answers 500.
//
// Nothing the suite runs can see that, because nothing in it builds: `npm run
// test:kit` builds a SvelteKit app and sees the 500. Bryntime imports the engine
// where it starts it, and holds that itself. What is Svelthon's is that nothing
// of its own loads the engine or starts it, read here as text.
import { test, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name) =>
    readFileSync(fileURLToPath(new URL(`../src/lib/${name}`, import.meta.url)), 'utf8');

describe('the engine is loaded and started by Bryntime alone', () => {
    // The compiler loads no engine of its own: neither the engine's file nor a
    // start.
    test('compile.js loads no engine', () => {
        const source = read('compile.js');

        expect(source).not.toMatch(/['"][^'"]*brython_runtime\.js['"]/);
        expect(source).not.toContain('$B.brython(');
    });

    // And it imports Bryntime before anything else, which static imports run
    // in the order written, the order a bundler keeps.
    test('compile.js imports Bryntime first', () => {
        const imports = [...read('compile.js').matchAll(/^import\b[^'"]*?['"]([^'"]+)['"];/gm)].map(([, from]) => from);

        expect(imports[0]).toBe('bryntime');
        expect(imports.length).toBeGreaterThan(1);
    });

    // The import used to sit in `bridge.js`, two lines above the import of the
    // module that starts it, which reads as an order and is not one.
    test('bridge.js does not import it', () => {
        expect(read('bridge.js')).not.toContain('vendor/brython');
    });
});
