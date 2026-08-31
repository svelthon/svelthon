// @vitest-environment node
//
// The preprocessor and the Vite plugin, called directly. Every other test goes
// through them, but from inside Vite's own process, where coverage cannot see
// them — 16 % measured on a module that runs for every file in the project.
// These call the hooks the way Svelte and Vite do.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { python, svelthon, withPrelude } from '../src/lib/svelthon.js';

const { VIRTUAL_PREFIX } = createRequire(import.meta.url)('../src/lib/compile.cjs');
const fixtures = resolve(import.meta.dirname, 'fixtures');

// The template language follows the script language, with no third mode: a
// component without `lang="python"` is a JavaScript component and stays one.
// Python semantics are opt-in, per file — never injected behind an author's back.
describe('the preprocessor decides by the script tag', () => {
    const pre = python();

    test('a component without lang="python" is left untouched', () => {
        expect(pre.markup({ content: '<script>let a = 1</script>\n<p>{a}</p>', filename: 'A.svelte' }))
            .toBeUndefined();
    });

    test('a component with it has its markup rewritten', () => {
        const out = pre.markup({
            content: '<script lang="python">\ncount = 0\n</script>\n<p>{count}</p>',
            filename: 'B.svelte'
        });

        expect(out.code).toContain('__expr_0()');
        expect(out.code).toContain('<script lang="python">');
    });

    test('a script that is not Python is not compiled', () => {
        expect(pre.script({ content: 'let a = 1', attributes: {}, filename: 'C.svelte' }))
            .toBeUndefined();
        expect(pre.script({ content: 'let a = 1', attributes: { lang: 'ts' }, filename: 'C.svelte' }))
            .toBeUndefined();
    });

    // The markup pass has to have run first: its hidden functions are what the
    // script pass appends to the author's Python.
    test('the script pass turns Python into a component script', () => {
        // A real file: the script hook reads it whole, so a debugger opens the
        // `.svelte` rather than a thousand lines of generated JavaScript.
        const filename = resolve(fixtures, 'BlockScope.svelte');
        const content = readFileSync(filename, 'utf8').match(
            /<script lang="python">([\s\S]*?)<\/script>/
        )[1];

        pre.markup({ content: readFileSync(filename, 'utf8'), filename });
        const out = pre.script({ content, attributes: { lang: 'python' }, filename });

        expect(out.code).toContain('$state');
        expect(out.code).toContain('__expr_0');
    });

    // The content is JavaScript now, so the tag must stop claiming otherwise.
    // Leaving `lang="python"` is invisible to the Svelte compiler and fatal to
    // everything downstream that reads the attribute — `svelte-check` first.
    test('and drops the lang attribute, keeping the others', () => {
        const filename = resolve(fixtures, 'BlockScope.svelte');
        const content = readFileSync(filename, 'utf8').match(
            /<script lang="python">([\s\S]*?)<\/script>/
        )[1];

        pre.markup({ content: readFileSync(filename, 'utf8'), filename });
        const out = pre.script({
            content,
            attributes: { lang: 'python', generics: 'T' },
            filename
        });

        expect(out.attributes).toEqual({ generics: 'T' });
    });
});

// The plugin serves the generated modules and resolves the `.py` a component
// imports. `enforce: 'pre'`, or Vite's own resolver claims `./store.py` as a
// plain file and hands its Python straight to the JavaScript parser.
describe('the plugin resolves what Vite cannot', () => {
    const plugin = svelthon();

    test('it runs before Vite’s own resolver', () => {
        expect(plugin.enforce).toBe('pre');
    });

    test('a virtual id is claimed with a null byte', () => {
        expect(plugin.resolveId(`${VIRTUAL_PREFIX}Counter`)).toBe(`\0${VIRTUAL_PREFIX}Counter`);
    });

    test('a sibling .py resolves against its importer', () => {
        const importer = resolve(fixtures, 'Anything.svelte');

        expect(plugin.resolveId('./shapes.py', importer)).toBe(resolve(fixtures, 'shapes.py'));
    });

    // SvelteKit hands its route modules to Vite already resolved, with nobody to
    // resolve against, and its entries are relative to the *project root* —
    // a path no filesystem has.
    test('a root-relative path is tried against the project root', () => {
        expect(plugin.resolveId('/tests/fixtures/shapes.py')).toBe(
            resolve(process.cwd(), 'tests/fixtures/shapes.py')
        );
    });

    test('a bare specifier belongs to whoever defined the alias', () => {
        expect(plugin.resolveId('#lib/peps.py', resolve(fixtures, 'A.svelte'))).toBeUndefined();
    });

    test('anything that is not Python is left alone', () => {
        expect(plugin.resolveId('./helper.js', resolve(fixtures, 'A.svelte'))).toBeUndefined();
    });

    test('an unknown virtual module loads as nothing', () => {
        expect(plugin.load('\0' + VIRTUAL_PREFIX + 'NeverCompiled')).toBeUndefined();
    });

    // The two halves meet here: the preprocessor compiles and files the module
    // away, the plugin serves it — with the map, which is what a debugger
    // follows back to the `.svelte`.
    test('a compiled component is served with its source map', () => {
        const filename = resolve(fixtures, 'BlockScope.svelte');
        const whole = readFileSync(filename, 'utf8');
        const pre = python();

        pre.markup({ content: whole, filename });
        pre.script({
            content: whole.match(/<script lang="python">([\s\S]*?)<\/script>/)[1],
            attributes: { lang: 'python' },
            filename
        });

        // The module is filed under the path, not the basename: two components
        // may share a name and only the path tells them apart.
        const name = relative(process.cwd(), filename).replace(/\W/g, '_');
        const served = plugin.load('\0' + VIRTUAL_PREFIX + name);

        expect(served.code).toContain('$B');
        expect(served.map.sources[0]).toContain('BlockScope.svelte');
        expect(served.map.sourcesContent[0]).toContain('<script lang="python">');
    });
});

// A prelude is prepended to a generated module, and a source map is a list of
// segments per generated line. Text added at the top shifts every one of them,
// so the prelude has to pay for its own lines — one `;` each.
describe('withPrelude keeps the source map honest', () => {
    const map = { mappings: 'AAAA;AACA;AAEA' };

    test('no prelude, nothing moves', () => {
        expect(withPrelude('code', map, '')).toEqual({ code: 'code', map });
    });

    test('a one-line prelude shifts by one', () => {
        const out = withPrelude('code', map, 'import x');

        expect(out.code).toBe('import x\ncode');
        expect(out.map.mappings).toBe(';AAAA;AACA;AAEA');
    });

    // Two imports used to cost one `;`, and every line of the file pointed one
    // line above where it came from.
    test('a three-line prelude shifts by three', () => {
        expect(withPrelude('code', map, 'a\nb\nc').map.mappings).toBe(';;;AAAA;AACA;AAEA');
    });

    test('the original map is not mutated', () => {
        withPrelude('code', map, 'a\nb');

        expect(map.mappings).toBe('AAAA;AACA;AAEA');
    });
});
