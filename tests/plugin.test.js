// @vitest-environment node
//
// The preprocessor and the Vite plugin, called directly. Every other test goes
// through them, but from inside Vite's own process, where coverage cannot see
// them — 16 % measured on a module that runs for every file in the project.
// These call the hooks the way Svelte and Vite do.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import { resolve, relative } from 'node:path';
import { readFileSync } from 'node:fs';
import { preprocess, parse } from 'svelte/compiler';
import { python, svelthon, withPrelude } from '../src/lib/svelthon.js';

const { VIRTUAL_PREFIX } = createRequire(import.meta.url)('../src/lib/compile.cjs');
const fixtures = resolve(import.meta.dirname, 'fixtures');

// A fixture through Svelte's own `preprocess`, which runs the `markup` hook and
// then the `script` hook with the attributes of the tag the first one wrote.
const preprocessed = (filename, pre = python()) =>
    preprocess(readFileSync(filename, 'utf8'), [pre], { filename });

// What the preprocessor writes into a custom element's written-out option,
// read back with Svelte's parser: the author's entries, then the declared props
// they do not name, which is the order Svelte lists them in, and the file on as
// many lines as it had, since Svelte places its warnings by line.
describe('the props a written-out customElement option is given', () => {
    const written = (props) =>
        `<svelte:options customElement={{\n    tag: 'x-el',\n    props: ${props},\n}} />\n\n` +
        `<script lang="python">\nfirst: str = "a"\nmiddle: int = 1\nlast: str = "z"\n</script>\n\n<p>{first}</p>\n`;

    const read = (source) => {
        const { code } = python().markup({ content: source, filename: 'X.svelte' });
        const blanked = code.replace(/<script[\s\S]*?<\/script>/, '');
        const option = parse(blanked, { modern: true }).options.attributes.find((one) => one.name === 'customElement');
        const props = option.value.expression.properties.find((one) => one.key.name === 'props').value;

        return { keys: props.properties.map((one) => one.key.name), lines: code.split('\n').length };
    };

    test.for([
        ['{}', ['first', 'middle', 'last']],
        ['{ middle: { reflect: true } }', ['middle', 'first', 'last']],
        ['{\n        extra: {},\n        last: { type: "String" },\n    }', ['extra', 'last', 'first', 'middle']]
    ])('props: %s', ([props, keys]) => {
        const source = written(props);

        expect(read(source)).toEqual({ keys, lines: source.split('\n').length });
    });
});

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
        expect(out.code).toMatch(/<script [^>]*\blang="python">/);
    });

    // HTML allows whitespace before the `>` of a closing tag and Svelte's parser
    // reads it, but Svelte's *preprocessor* does not: its pattern ends in
    // `<\/script>`. So the script hook is never called for such a block while
    // the compiler accepts the file, the markup is compiled for Python, and the
    // Python reaches Svelte as JavaScript — `count is not defined`, about a name
    // the author wrote. Refused here, where both halves are known.
    test.for([['</script >'], ['</script\n>'], ['</script\t>']])(
        'a Python script closed with `%s` is refused',
        ([closing]) => {
            expect(() =>
                pre.markup({
                    content: `<script lang="python">\ncount = 0\n${closing}\n<p>{count}</p>`,
                    filename: 'Spaced.svelte'
                })
            ).toThrow(/only recognises `<\/script>`/);
        }
    );

    // The language is decided twice about one file: here, from the text, and
    // again by the `script` hook from the attributes Svelte parsed. A row where
    // the two disagree is a broken component whichever way round it falls — a
    // template compiled for Python around a JavaScript body gives `__expr_0 is
    // not defined`, and a Python body under a JavaScript template gives `count
    // is not defined`, about a name the author wrote.
    //
    // So the table is the test: every spelling, and every place the six letters
    // can sit that is not a declaration, with both halves read for each. Four
    // rows used to disagree, and only two of them were ever reported.
    const halves = async (content, filename) => {
        const template = pre.markup({ content, filename }) === undefined ? 'javascript' : 'python';
        let script = 'not called';

        await preprocess(
            content,
            {
                name: 'reading',
                // Svelte's own answer, which the script hook below cannot be
                // talked out of: this is the half the detector has to match.
                script: ({ attributes }) =>
                    void (script = attributes.lang === 'python' ? 'python' : 'untouched')
            },
            { filename }
        );

        return [template, script];
    };

    const body = (tag) => `${tag}\ncount = 0\n</script>\n<p>{count}</p>`;

    test.for([
        ['double quotes', body('<script lang="python">'), 'python', 'python'],
        ['single quotes', body("<script lang='python'>"), 'python', 'python'],
        // Svelte's parser takes an unquoted value and hands the hook
        // `lang: 'python'`. The detector required the quotes, so the body was
        // compiled as Python and the template around it was left JavaScript.
        ['no quotes at all', body('<script lang=python>'), 'python', 'python'],
        ['a newline before the attribute', body('<script\n    lang="python">'), 'python', 'python'],
        // The one row that disagrees on purpose. Whitespace around `=` is legal
        // HTML, Svelte's *preprocessor* silently never calls the script hook for
        // it, and Svelte's *parser* then refuses the file outright with
        // `Expected token >` — so nothing is silent and there is no component to
        // save. Read wide anyway: a detection narrower than HTML is a second
        // grammar to keep in step, and the day Svelte relaxes, this reads what
        // Svelte reads.
        ['spaces around the equals', body('<script lang = "python">'), 'python', 'not called'],
        // `\blang` matched inside `data-lang`, a hyphen being no word character.
        ['a prefix on the name', body('<script data-lang="python">'), 'javascript', 'untouched'],
        ['a suffix on the value', body('<script lang="python3">'), 'javascript', 'untouched'],
        ['another language', body('<script lang="ts">'), 'javascript', 'untouched'],
        // And the three places the text can sit without being a tag at all. A
        // component that shows a code sample declared Python by quoting one.
        [
            'quoted in a JavaScript string',
            '<script>const e = \'<script lang="python">\';</script>\n<p>{1}</p>',
            'javascript',
            'untouched'
        ],
        [
            'quoted in a style body',
            '<style>/* <script lang="python"> */</style>\n<p>{1}</p>',
            'javascript',
            'not called'
        ],
        [
            'quoted in an HTML comment',
            '<!-- <script lang="python">x = 1</script> -->\n<p>{1}</p>',
            'javascript',
            'not called'
        ]
    ])('%s: the template is %s and the script %s', async ([name, content, template, script]) => {
        expect(await halves(content, `${name.replace(/\W+/g, '-')}.svelte`)).toEqual([template, script]);
    });

    // And a tag quoted inside a comment is documentation. It used to turn a
    // JavaScript component's expressions into Python, which refuses most of
    // them.
    test('a tag inside a comment declares nothing', () => {
        expect(
            pre.markup({
                content: '<!-- <script lang="python"> -->\n<script>let a = 1</script>\n<p>{a ? 1 : 0}</p>',
                filename: 'C1.svelte'
            })
        ).toBeUndefined();
    });

    // Comments are blanked rather than cut, so the line a refusal names is still
    // counted on the file the author is looking at.
    test('and a comment before a real tag keeps the line count', () => {
        const out = pre.markup({
            content: '<!-- doc\n<script lang="python">\n-->\n<script lang="python">\ncount = 0\n</script>\n<p>{count}</p>',
            filename: 'C2.svelte'
        });

        expect(out.code).toContain('__expr_0()');
        expect(out.code.split('\n')[0]).toBe('<!-- doc');
    });

    test('a script that is not Python is not compiled', () => {
        expect(pre.script({ content: 'let a = 1', attributes: {}, filename: 'C.svelte' }))
            .toBeUndefined();
        expect(pre.script({ content: 'let a = 1', attributes: { lang: 'ts' }, filename: 'C.svelte' }))
            .toBeUndefined();
    });

    // The markup pass has to have run first: its hidden functions are what the
    // script pass appends to the author's Python.
    test('the script pass turns Python into a component script', async () => {
        // A real file: the script hook reads it whole, so a debugger opens the
        // `.svelte` rather than a thousand lines of generated JavaScript.
        const filename = resolve(fixtures, 'BlockScope.svelte');
        const { code } = await preprocess(readFileSync(filename, 'utf8'), [pre], { filename });
        const script = code.match(/<script>([\s\S]*?)<\/script>/)[1];

        expect(script).toContain('$state');
        expect(script).toContain('__expr_0');
    });

    // The content is JavaScript now, so the tag must stop claiming otherwise.
    // Leaving `lang="python"` is invisible to the Svelte compiler and fatal to
    // everything downstream that reads the attribute — `svelte-check` first.
    // The attribute the markup pass adds for the script pass goes with it.
    test('and drops the lang attribute, keeping the others', async () => {
        const filename = resolve(fixtures, 'BlockScope.svelte');
        const source = readFileSync(filename, 'utf8').replace(
            '<script lang="python">',
            '<script lang="python" generics="T">'
        );
        const { code } = await preprocess(source, [pre], { filename });

        expect(code.match(/<script\b[^>]*>/)[0]).toBe('<script generics="T">');
    });
});

// One component, one generated module. Both script blocks derive their id from
// `nameFor(filename)`, so a Python module block's body was dropped by
// `generated.set()` and Svelte then concatenated two scripts that each declared
// `init`. What the author read was `` `init` has already been declared `` at
// line 58 of a ten-line file: loud, and about nothing they had written.
describe('a Python <script module> is refused, with the answer', () => {
    const component = (attrs) =>
        `<script ${attrs} lang="python">\nshared = 0\n</script>\n` +
        `<script lang="python">\ncount = 1\n</script>\n<p>{count}</p>`;

    const refused = (attributes) => () =>
        python().script({ content: 'shared = 0\n', attributes, filename: 'src/Thing.svelte' });

    test('the modern spelling is refused', () => {
        expect(refused({ module: true, lang: 'python' })).toThrow(
            /a <script module> cannot hold Python/
        );
    });

    // Svelte 5 still parses Svelte 4's spelling, so the same mistake arrives
    // under two names and has to be caught under both.
    test('and so is the one Svelte 4 used', () => {
        expect(refused({ context: 'module', lang: 'python' })).toThrow(
            /a <script module> cannot hold Python/
        );
    });

    test('the message names the file and the file kind to use instead', () => {
        expect(refused({ module: true, lang: 'python' })).toThrow(
            /belongs in a \.svelte\.py module.*\(src\/Thing\.svelte\)/
        );
    });

    // The guard reads the language first: a JavaScript module block beside a
    // Python instance block declares nothing of ours and collides with nothing.
    test('a JavaScript module block in a Python component is left alone', () => {
        expect(
            python().script({
                content: 'export const kind = "widget";',
                attributes: { module: true },
                filename: 'src/Thing.svelte'
            })
        ).toBeUndefined();
    });

    // Through Svelte's own `preprocess`, which is what fills `attributes`: the
    // refusal has to be what the author meets, not something only reachable by
    // calling the hook by hand.
    test('and it is what Svelte itself runs into', async () => {
        await expect(
            preprocess(component('module'), python(), { filename: 'src/Thing.svelte' })
        ).rejects.toThrow(/a <script module> cannot hold Python/);
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
    test('a compiled component is served with its source map', async () => {
        const filename = resolve(fixtures, 'BlockScope.svelte');

        await preprocessed(filename);

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

// A `.py` is loaded by the plugin rather than preprocessed by Svelte: no markup,
// no `<script>`, just a module. A `.svelte.py` is served under a `.svelte.js`
// identity, which is what makes vite-plugin-svelte compile the runes inside it.
describe('the plugin loads a .py itself', () => {
    const plugin = svelthon();
    const file = resolve(fixtures, 'shapes.py');

    // `addWatchFile` and `environment` are what Vite gives a hook as `this`.
    const context = { watched: [], addWatchFile(one) { this.watched.push(one); } };

    test('a module compiles to a component script', () => {
        const code = plugin.load.call(context, file);

        expect(code).toContain('init');
        expect(context.watched).toContain(file);
    });

    test('and its generated body is then served on demand', () => {
        plugin.load.call(context, file);

        const name = relative(process.cwd(), file).replace(/\W/g, '_');
        const served = plugin.load.call(context, '\0' + VIRTUAL_PREFIX + name);

        expect(served.code).toContain('$B');
        expect(served.map.sources[0]).toContain('shapes.py');
    });

    test('anything that is not a .py is left to Vite', () => {
        expect(plugin.load.call(context, resolve(fixtures, 'Groups.svelte'))).toBeUndefined();
    });
});

// A component's generated code lives in its own module, which Vite has no reason
// to tie to the `.svelte` that produced it. Without this hook, editing the Python
// re-transforms the component and keeps serving the previous generated body: the
// page updates to code that never changed.
describe('hot update invalidates the generated module too', () => {
    const plugin = svelthon();

    const graph = () => {
        const invalidated = [];

        return {
            invalidated,
            moduleGraph: {
                getModuleById: (id) => ({ id }),
                invalidateModule: (mod) => invalidated.push(mod.id)
            }
        };
    };

    test('editing a component forgets its generated body', async () => {
        const filename = resolve(fixtures, 'BlockScope.svelte');

        await preprocessed(filename);

        const env = graph();
        const out = plugin.hotUpdate.call({ environment: env }, { file: filename, modules: [] });
        const name = relative(process.cwd(), filename).replace(/\W/g, '_');

        expect(env.invalidated).toContain('\0' + VIRTUAL_PREFIX + name);
        expect(out).toHaveLength(1);
    });

    // A store's `.py` is watched, not imported, so its own module has to go too
    // — otherwise its load() never reruns and the previous body stands.
    test('editing a .py forgets the file as well as its module', () => {
        const file = resolve(fixtures, 'shapes.py');
        plugin.load.call({ addWatchFile() {} }, file);

        const env = graph();
        plugin.hotUpdate.call({ environment: env }, { file, modules: [] });

        expect(env.invalidated).toContain(file);
    });

    // The test count is read from the filesystem once, and the module holding it
    // depends on no file Vite can see.
    test('adding a test forgets the count', () => {
        const env = graph();
        const out = plugin.hotUpdate.call(
            { environment: env },
            { file: resolve(process.cwd(), 'tests/markup.test.js'), modules: [] }
        );

        expect(env.invalidated.some((id) => id.includes('stats'))).toBe(true);
        expect(out).toHaveLength(1);
    });

    test('a file with no generated module is left alone', () => {
        const env = graph();

        expect(
            plugin.hotUpdate.call({ environment: env }, { file: '/nowhere/Unknown.svelte', modules: [] })
        ).toBeUndefined();
        expect(env.invalidated).toEqual([]);
    });
});

// Two rewrites happen before Brython sees the source, and neither is Python:
// `importjs` names JavaScript a module cannot import, and `x => expr` is the
// arrow that declares a derived. Both run for every component that uses them,
// and both were reached only from inside Vite's process.
describe('the rewrites that precede Brython', () => {
    // The component's script, which is what the `script` hook returns.
    const compiled = async (name) =>
        (await preprocessed(resolve(fixtures, name))).code.match(/<script>([\s\S]*?)<\/script>/)[1];

    test('importjs becomes a JavaScript import, in the component', async () => {
        const code = await compiled('ImportJsLines.svelte');

        expect(code).toMatch(/import .* from ['"]/);
    });

    test('an arrow becomes a derived', async () => {
        expect(await compiled('ArrowDerived.svelte')).toContain('$derived');
    });

    test('an arrow with no name becomes an effect', async () => {
        expect(await compiled('ArrowEffect.svelte')).toContain('$effect');
    });
});

// A `.svelte.py` is not a route module: its names become module-scope signals,
// created once for the whole application, and it is served under a `.svelte.js`
// identity so that vite-plugin-svelte compiles the runes inside it.
describe('a store takes the other branch of the compiler', () => {
    const plugin = svelthon();
    const file = resolve(fixtures, 'root_store.svelte.py');

    test('its names are signals, reachable through a store object', () => {
        const code = plugin.load.call({ addWatchFile() {} }, file);

        expect(code).toContain('$state');
        expect(code).toContain('export const store');
    });

    test('and a default export, which a route module does not have', () => {
        expect(plugin.load.call({ addWatchFile() {} }, file)).toContain('export default store');
    });
});

// A component that imports a sibling `.py` gets a prelude: the module has to be
// evaluated before init() runs, so its namespace is registered by the time
// Brython looks it up.
describe('a component importing a module', () => {
    test('is served with the import ahead of its own body', async () => {
        const filename = resolve(fixtures, 'RootStore.svelte');

        await preprocessed(filename);

        const name = relative(process.cwd(), filename).replace(/\W/g, '_');
        const served = svelthon().load('\0' + VIRTUAL_PREFIX + name);

        expect(served.code).toMatch(/^import ".*root_store/m);

        // The prelude pays for its own lines, or every mapping points one line
        // above where it came from.
        expect(served.map.mappings.startsWith(';')).toBe(true);
    });
});

// The demo shows how many tests back the project. Hard-coding it means letting
// it drift on every addition, so it is counted when the module is served.
describe('the test count is served, not written down', () => {
    test('it is a number, and it is not zero', () => {
        const code = svelthon().load('\0' + VIRTUAL_PREFIX + 'stats');
        const count = Number(code.match(/= (\d+);/)[1]);

        expect(count).toBeGreaterThan(400);
    });
});
