// @vitest-environment node
//
// The engine is a CommonJS file, so a bundler wraps it in a lazy initialiser and
// places the call where the binding is used, not where the import sits. Left to
// a neighbour's import order, that call lands after `boot.js` in a production
// server build and `$B.brython` is undefined: the site builds and answers 500.
//
// Nothing the suite runs can see that, because nothing in it builds: `npm run
// test:kit` builds a SvelteKit app and sees the 500. Here, what holds it is the
// shape of the graph, read as text: the file that starts the engine is the
// file that imports it.
import { test, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name) =>
    readFileSync(fileURLToPath(new URL(`../src/lib/${name}`, import.meta.url)), 'utf8');

describe('the engine is imported where it is started', () => {
    test('boot.js imports it', () => {
        expect(read('bryntime/boot.js')).toMatch(/^import '\.\.\/\.\.\/\.\.\/vendor\/brython_runtime\.js';$/m);
    });

    test('and it is the file that calls brython()', () => {
        expect(read('bryntime/boot.js')).toContain('$B.brython(');
    });

    // The engine has one loader, Bryntime's. The compiler adds the parsing
    // chain to it and loads no engine of its own: neither the engine's file
    // nor a start.
    test('compile.cjs loads no engine', () => {
        const source = read('compile.cjs');

        expect(source).not.toMatch(/require\('[^']*brython_runtime\.js'\)/);
        expect(source).not.toContain('$B.brython(');
        expect(source).toContain("require('../../vendor/brython_compiler.js');");
    });

    // And the way JavaScript reaches it, `svelthon/compile`, imports Bryntime
    // first, an ES module importing ES and then CommonJS, the order a bundler
    // keeps.
    test('compile.js imports Bryntime before compile.cjs', () => {
        const imports = [...read('compile.js').matchAll(/^import\s+(?:\S+\s+from\s+)?'([^']+)';/gm)].map(([, from]) => from);

        expect(imports).toEqual(['./bryntime/bryntime.js', './compile.cjs']);
    });

    // The import used to sit in `runtime.js`, two lines above `import
    // './boot.js'`, which reads as an order and is not one.
    test('runtime.js does not import it', () => {
        expect(read('runtime.js')).not.toContain('vendor/brython');
    });

    // `browser-check.sh` warms the engine before it measures, because a cold
    // transform overruns the browser's budget on a modest machine. It names the
    // file in a string, so it drifts the day `boot.js` names another: the warm-up
    // then heats a file no page asks for and leaves the real one cold, and the
    // check fails intermittently rather than clearly.
    test('the browser check warms the file boot.js names', () => {
        const engine = read('bryntime/boot.js').match(/vendor\/(\w+\.js)/)[1];
        const script = readFileSync(
            fileURLToPath(new URL('../scripts/browser-check.sh', import.meta.url)),
            'utf8'
        );

        expect(script).toContain(`/vendor/${engine}"`);
    });
});
