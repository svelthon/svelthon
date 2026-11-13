// @vitest-environment node
//
// The preprocessor and the Vite plugin, called directly. Every other test goes
// through them, but from inside Vite's own process, where coverage cannot see
// them — 16 % measured on a module that runs for every file in the project.
// These call the hooks the way Svelte and Vite do.
import { test, expect, describe, afterEach } from 'vitest';
import { resolve, relative, join } from 'node:path';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { preprocess, parse } from 'svelte/compiler';
import { python, svelthon, withPrelude } from '../src/lib/svelthon.js';
import { VIRTUAL_PREFIX, elementProps } from '../src/lib/compile.js';

const fixtures = resolve(import.meta.dirname, 'fixtures');

// A fixture through Svelte's own `preprocess`, which runs the `markup` hook and
// then the `script` hook with the attributes of the tag the first one wrote.
const preprocessed = (filename, pre = python()) =>
    preprocess(readFileSync(filename, 'utf8'), [pre], { filename });

// The generated body a preprocessed component imports: its name, told apart by
// what it was compiled from.
const bodyOf = (code) => code.match(/from "(virtual:svelthon\/[^"]+)"/)[1];

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

    // And `{null}`, which declares nothing, is left to Svelte, which skips it:
    // written out as props, it made an element where Svelte makes none.
    test('customElement={null} is left as it is written', () => {
        const source = '<svelte:options customElement={null} />\n\n<script lang="python">\nfirst: str = "a"\n</script>\n\n<p>{first}</p>\n';

        expect(python().markup({ content: source, filename: 'X.svelte' }).code).toContain('<svelte:options customElement={null} />');
    });
});

// The type of each prop is its annotation's at the top of the module, or in a
// block there; not a field's of a class, nor a local's of a function, which
// share the name and are not the prop. Read inside them, `count: int` of a
// class made the element's `count: str` a Number.
test('a custom element prop takes its type from its own annotation, not a class field of its name', () => {
    expect(elementProps('count: str = "0"\n\nclass Row:\n    count: int = 0\n\ndef f():\n    count: float = 1.0\n')).toEqual([
        { name: 'count', type: 'String' }
    ]);
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

    // An attribute's name is read in any case, by both passes: the markup was
    // compiled for `<script LANG="python">` while the script went through as
    // JavaScript, and the page said `rows is not defined`.
    test('and reads the attribute in any case, as the markup pass does', async () => {
        const filename = resolve(fixtures, 'BlockScope.svelte');
        const source = readFileSync(filename, 'utf8').replace('<script lang="python">', '<script LANG="python">');
        const { code } = await preprocess(source, [pre], { filename });

        expect(code.match(/<script\b[^>]*>/)[0]).toBe('<script>');
        expect(code.match(/<script>([\s\S]*?)<\/script>/)[1]).toContain('$state');
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

    // And it has Vite transform Svelthon for the server, as vite-plugin-svelte
    // has it transform Svelte and `esm-env`. Left to Node, as a package from
    // npm was, the bridge's `esm-env` read a `window`, and a server with a DOM
    // on its global rendered as a browser. The repository cannot show it: its
    // alias puts the bridge outside `node_modules`, which Vite transforms.
    test('it has Vite transform Svelthon for the server', () => {
        expect(plugin.config().ssr.noExternal).toContain('svelthon');
    });

    // A `.py` reached by a link is the file the link leads to, as Vite resolves
    // a file unless told to keep links: taken by its two paths, one file was
    // two of one Python name, and its second import was refused as a clash.
    test('a link to a .py, or to its folder, resolves to the file it leads to, unless links are kept', () => {
        const dir = mkdtempSync(join(tmpdir(), 'svelthon-links-'));

        mkdirSync(join(dir, 'real'));
        mkdirSync(join(dir, 'alias'));
        writeFileSync(join(dir, 'real', 'shared.py'), 'answer = 42\n');
        symlinkSync(join('..', 'real', 'shared.py'), join(dir, 'alias', 'shared.py'));
        symlinkSync('real', join(dir, 'folder'));

        try {
            const importer = join(dir, 'Main.svelte');
            const real = realpathSync(join(dir, 'real', 'shared.py'));
            const linked = svelthon();

            expect(
                ['./real/shared.py', './alias/shared.py', './folder/shared.py'].map((one) => linked.resolveId(one, importer))
            ).toEqual([real, real, real]);

            linked.configResolved({ root: dir, resolve: { preserveSymlinks: true }, plugins: [] });
            expect(linked.resolveId('./alias/shared.py', importer)).toBe(join(dir, 'alias', 'shared.py'));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    // But a link named otherwise than its target is the module Python imports
    // by the link's name: taken for its target, `config.py` leading to
    // `settings_dev.py` was compiled as `settings_dev`, and `import config`
    // found no module; and a store leading to a plain file was no store.
    test('a link named otherwise than its target is the link, its name and its kind', () => {
        const dir = mkdtempSync(join(tmpdir(), 'svelthon-links-'));

        writeFileSync(join(dir, 'settings_dev.py'), 'where = "settings"\n');
        writeFileSync(join(dir, 'cart_impl.py'), 'count = 3\n');
        symlinkSync('settings_dev.py', join(dir, 'config.py'));
        symlinkSync('cart_impl.py', join(dir, 'cart.svelte.py'));

        try {
            const importer = join(dir, 'Main.svelte');

            expect(['./config.py', './cart.svelte.py'].map((one) => svelthon().resolveId(one, importer))).toEqual([
                join(dir, 'config.py'),
                join(dir, 'cart.svelte.py')
            ]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('a virtual id is claimed with a null byte', () => {
        expect(plugin.resolveId(`${VIRTUAL_PREFIX}Counter`)).toBe(`\0${VIRTUAL_PREFIX}Counter`);
    });

    test('a sibling .py resolves against its importer', () => {
        const importer = resolve(fixtures, 'Anything.svelte');

        expect(plugin.resolveId('./shapes.py', importer)).toBe(resolve(fixtures, 'shapes.py'));
    });

    // Python's import asks for a module under `?python`, an author under a query
    // of their own, and the module keeps it; a module of remote functions is
    // served once, under its own path, whoever asks for it. Vite's own queries
    // are Vite's.
    test('a module keeps its query, Python’s or the author’s, but for a remote one', () => {
        const importer = resolve(fixtures, 'Anything.svelte');
        const [shapes, remote] = ['shapes.py', 'remote.py'].map((one) => resolve(fixtures, one));

        expect(plugin.resolveId(`${shapes}?python`, importer)).toBe(`${shapes}?python`);
        expect(plugin.resolveId(`${remote}?python`, importer)).toBe(remote);
        expect(plugin.resolveId('./shapes.py?v=2', importer)).toBe(`${shapes}?v=2`);
        expect(plugin.resolveId('./shapes.py#v2', importer)).toBe(`${shapes}#v2`);
        expect(plugin.resolveId('./remote.py?v=2', importer)).toBe(remote);
        expect(plugin.resolveId('./shapes.py?raw', importer)).toBeUndefined();
    });

    // A `#` before the last `/` is a folder's, `has#hash/`, and no fragment.
    test('a module in a folder whose name holds a # keeps its whole path', () => {
        const importer = resolve(fixtures, 'Anything.svelte');
        const inside = resolve(fixtures, 'has#hash', 'shapes.py');

        expect(plugin.resolveId('./has#hash/shapes.py', importer)).toBe(inside);
        expect(plugin.resolveId('./has#hash/shapes.py#v2', importer)).toBe(`${inside}#v2`);
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

        const { code } = await preprocessed(filename);

        // The module is filed under the path, not the basename: two components
        // may share a name and only the path tells them apart.
        const name = relative(process.cwd(), filename).replace(/\W/g, '_');
        const served = plugin.load('\0' + bodyOf(code));

        expect(bodyOf(code).startsWith(`${VIRTUAL_PREFIX}${name}?`)).toBe(true);
        expect(served.code).toContain('$B');
        expect(served.map.sources[0]).toContain('BlockScope.svelte');
        expect(served.map.sourcesContent[0]).toContain('<script lang="python">');
    });
});

// A prelude is prepended to a generated module, and a source map is a list of
// segments per generated line. Text added at the top shifts every one of them,
// so the prelude has to pay for its own lines — one `;` each.
// SvelteKit's guard against a server module in the browser sees what reaches
// its resolution and load first. Listed after Svelthon, which resolves and loads
// what Python imports, it saw none of it, and a module of `src/lib/server/`
// imported by a Python page was built into the client.
describe("the plugin comes after SvelteKit's guard", () => {
    const resolved = (...names) => ({ root: '/', resolve: {}, plugins: names.map((name) => ({ name })) });

    test('and refuses to come before it', () => {
        expect(() => svelthon().configResolved(resolved('svelthon:modules', 'vite-plugin-sveltekit-guard'))).toThrow(
            /list `sveltekit\(\)` before `svelthon\(\)`/
        );
    });

    test('and takes its place after it, or where SvelteKit is not', () => {
        expect(() => svelthon().configResolved(resolved('vite-plugin-sveltekit-guard', 'svelthon:modules'))).not.toThrow();
        expect(() => svelthon().configResolved(resolved('svelthon:modules', 'vite-plugin-svelte'))).not.toThrow();
    });
});

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
        const code = plugin.load.call(context, `${file}?python`);

        expect(code).toContain('init');
        expect(context.watched).toContain(file);
    });

    // What JavaScript imports runs the body as it is evaluated, and hands on
    // the module's names, and nothing but them.
    test('and its own path runs the module JavaScript imports', () => {
        const code = plugin.load.call(context, file);

        expect(code).toContain(`import load from ${JSON.stringify(`${file}?python`)};\nload();`);
        expect(code).toContain(`export * from ${JSON.stringify(`${file}?python`)};`);
        expect(code).not.toContain('default');
    });

    // Under a query or a fragment of the author's, the same, cut where Vite
    // cuts an id: a build handed `shapes.py#v2` the Python itself.
    test('and so does its path under a query or a fragment of the author’s, but not under Vite’s own', () => {
        const own = plugin.load.call(context, file);

        expect([`${file}?v=2`, `${file}#v2`].map((one) => plugin.load.call(context, one))).toEqual([own, own]);
        expect(plugin.load.call(context, `${file}?raw`)).toBeUndefined();
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

    // A route's `load()` is handed back as a plain object, by the module that
    // binds it, and only where the module exports one: a route of actions
    // alone warned at each build that `load` would always be undefined.
    test("a route module's load is wrapped where the module has one", () => {
        const dir = mkdtempSync(join(tmpdir(), 'svelthon-route-'));
        const route = (name, source) => {
            mkdirSync(join(dir, name));
            writeFileSync(join(dir, name, '+page.server.py'), source);
            plugin.load.call(context, join(dir, name, '+page.server.py'));
            return plugin.load.call(context, join(dir, name, '+page.server.py') + '?python');
        };

        try {
            expect(route('loads', 'def load(event):\n    return {"n": 1}\n')).toContain('__export_load = __routeLoad(__value');
            expect(route('acts', 'def submit(event):\n    return None\n\nactions = {"default": submit}\n__all__ = ["actions"]\n')).not.toContain(
                '__export_load'
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
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

    // An edit: what was compiled is not what the file holds now.
    const beforeTheEdit = (filename) =>
        preprocess(`${readFileSync(filename, 'utf8')}<!-- before the edit -->\n`, [python()], { filename });

    test('editing a component forgets its generated body', async () => {
        const filename = resolve(fixtures, 'BlockScope.svelte');

        const { code } = await beforeTheEdit(filename);

        const env = graph();
        const out = plugin.hotUpdate.call({ environment: env }, { file: filename, modules: [] });

        expect(env.invalidated).toContain('\0' + bodyOf(code));
        expect(out.map((one) => one.id)).toEqual(env.invalidated);
    });

    // Each save is compiled under the id of the one before, the numbers handed
    // out again when the file changes, so every environment asks for the same
    // module again and Vite replaces it: an id per save left the server's
    // runner one body more each time. A file keeps one body per variant in use.
    test('and compiles an edit under the id it had', async () => {
        const filename = resolve(fixtures, 'BlockScope.svelte');
        const source = readFileSync(filename, 'utf8');
        const ids = [];

        await beforeTheEdit(filename);
        for (const save of [0, 1, 2]) {
            plugin.hotUpdate.call({ environment: graph() }, { file: filename, modules: [] });
            ids.push(bodyOf((await preprocess(`${source}<!-- save ${save} -->\n`, [python()], { filename })).code));
        }

        expect(new Set(ids).size).toBe(1);
        expect(plugin.load('\0' + ids[0]).map.sourcesContent[0]).toContain('save 2');
    });

    // And two contents at once, two variants of the file, keep two ids across an
    // edit, each its own body, whichever is compiled first.
    test('and keeps two variants apart across an edit', async () => {
        const filename = resolve(fixtures, 'Variant.svelte');
        const source = readFileSync(filename, 'utf8');
        const compiled = async (word) =>
            bodyOf((await preprocess(source.replace('"BASE"', JSON.stringify(word)), [python()], { filename })).code);
        const served = (id) => plugin.load('\0' + id).code;

        for (const order of [['alpha', 'beta'], ['beta', 'alpha']]) {
            plugin.hotUpdate.call({ environment: graph() }, { file: filename, modules: [] });

            const ids = [await compiled(order[0]), await compiled(order[1])];

            expect(ids[0]).not.toBe(ids[1]);
            expect([served(ids[0]).includes(order[0]), served(ids[0]).includes(order[1])]).toEqual([true, false]);
            expect([served(ids[1]).includes(order[1]), served(ids[1]).includes(order[0])]).toEqual([true, false]);
        }
    });

    // A store's `.py` is watched, not imported, so its own module has to go too
    // — otherwise its load() never reruns and the previous body stands. Under
    // both its ids: the one Python imports is the one with the query.
    test('editing a .py forgets the file as well as its module', () => {
        const file = resolve(fixtures, 'shapes.py');
        plugin.load.call({ addWatchFile() {} }, file);

        const env = graph();
        plugin.hotUpdate.call({ environment: env }, { file, modules: [] });

        expect(env.invalidated).toContain(file);
        expect(env.invalidated).toContain(`${file}?python`);
    });

    test('a file with no generated module is left alone', () => {
        const env = graph();

        expect(
            plugin.hotUpdate.call({ environment: env }, { file: '/nowhere/Unknown.svelte', modules: [] })
        ).toBeUndefined();
        expect(env.invalidated).toEqual([]);
    });

    // A parent reads the language of each child it imports. On the dev server a
    // child that changes language changes the parent, which the server watches
    // the child for, and a child edited in its own language changes none: the
    // children are no dependencies of their parent there. Each edit of one
    // asked the parent again, which, compiled as before, was mounted anew, its
    // state lost, and ran ahead of the child; or, taken for compiled as before,
    // was updated never, though a stylesheet its own style imports had changed.
    describe('a parent and the children it imports', () => {
        const parent = '<script lang="python">\nimportjs Child from "./Child.svelte"\n</script>\n<Child />\n';
        const pythonChild = '<script lang="python">\nx = 1\n</script>\n<p>{x}</p>\n';
        const javascriptChild = '<script>let x = 1;</script>\n<p>{x}</p>\n';

        const inRoom = async (body) => {
            const dir = mkdtempSync(join(tmpdir(), 'svelthon-parent-'));
            const at = (name) => join(dir, name);
            const compiled = (name) => preprocess(readFileSync(at(name), 'utf8'), [python()], { filename: at(name) });
            const asked = (name) =>
                plugin.hotUpdate.call({ environment: graph() }, { file: at(name), modules: [{ id: name }] }).map((one) => one.id);

            try {
                writeFileSync(at('Parent.svelte'), parent);
                writeFileSync(at('Child.svelte'), pythonChild);
                await body({ at, compiled, asked });
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        };

        // The changes the watcher of a dev server emits, once a child changed.
        // Open, as chokidar's says, until the test is done.
        const opened = [];
        const watching = () => {
            const handlers = {};
            const changed = [];
            const watcher = {
                closed: false,
                on: (event, handler) => (handlers[event] = handler),
                emit: (event, file) => changed.push([event, file])
            };

            opened.push(watcher);
            svelthon().configureServer({ watcher });
            return { handlers, changed, watcher };
        };

        afterEach(() => {
            for (const watcher of opened.splice(0)) watcher.closed = true;
        });

        test('the watcher changes the parent when a child changes language, and none when it keeps it', () =>
            inRoom(async ({ at, compiled }) => {
                const { handlers, changed } = watching();
                const done = await compiled('Parent.svelte');

                expect(done.dependencies).toEqual([]);

                writeFileSync(at('Child.svelte'), pythonChild.replace('x = 1', 'x = 2'));
                handlers.change(at('Child.svelte'));
                expect(changed).toEqual([]);

                writeFileSync(at('Child.svelte'), javascriptChild);
                handlers.change(at('Child.svelte'));
                expect(changed).toEqual([['change', at('Parent.svelte')]]);
            }));

        // A child a parent holds rather than imports, `<Child …/>` of a prop, is
        // told Python's or JavaScript's as the page runs, and Svelte's HMR keeps
        // the component across an edit: a JavaScript child edited into Python
        // was handed JavaScript's numbers until the page reloaded. So a file
        // that changes language reloads the page where such a parent is
        // compiled, and one edited in its own language updates as before: one
        // the page never loaded, and one refused then repaired.
        test('a child changing language reloads the page where a parent holds one', () =>
            inRoom(async ({ at, compiled }) => {
                const sent = [];
                const edited = (name, modules = [{ id: name }]) =>
                    plugin.hotUpdate.call(
                        { environment: { ...graph(), name: 'client', hot: { send: (message) => sent.push(message) } } },
                        { file: at(name), modules }
                    );

                writeFileSync(at('Holder.svelte'), '<script lang="python">\nChild: object\n</script>\n<Child amount={1.5} />\n');
                await compiled('Holder.svelte');
                await compiled('Child.svelte');

                writeFileSync(at('Child.svelte'), pythonChild.replace('x = 1', 'x = 2'));
                expect(edited('Child.svelte')).toContainEqual({ id: 'Child.svelte' });
                expect(sent).toEqual([]);

                writeFileSync(at('Unused.svelte'), pythonChild.replace('x = 1', 'x = 2'));
                edited('Unused.svelte', []);
                expect(sent).toEqual([]);

                writeFileSync(at('Child.svelte'), pythonChild.replace('x = 1', 'x = (1'));
                await expect(compiled('Child.svelte')).rejects.toThrow();
                writeFileSync(at('Child.svelte'), pythonChild.replace('x = 1', 'x = 3'));
                expect(edited('Child.svelte')).toContainEqual({ id: 'Child.svelte' });
                expect(sent).toEqual([]);

                writeFileSync(at('Child.svelte'), javascriptChild);
                expect(edited('Child.svelte')).toEqual([]);
                expect(sent).toEqual([{ type: 'full-reload' }]);
            }));

        // A dev server closed hands no change on: whatever compiles the parent
        // in the same process then, a build that watches or `preprocess()`,
        // takes each child for a dependency again.
        test('and a dev server closed leaves each child a dependency again', () =>
            inRoom(async ({ at, compiled }) => {
                const { watcher } = watching();

                expect((await compiled('Parent.svelte')).dependencies).toEqual([]);
                watcher.closed = true;
                expect((await compiled('Parent.svelte')).dependencies).toEqual([at('Child.svelte')]);
            }));

        // `python()` in `svelte.config.js` and `svelthon()` in `vite.config.js`
        // are two instances of this module: one compiles, the other watches.
        test('and so when the preprocessor is another instance of the module', () =>
            inRoom(async ({ at }) => {
                const another = await import('../src/lib/svelthon.js?another-instance');
                const { handlers, changed } = watching();

                expect(another.python).not.toBe(python);
                await preprocess(parent, [another.python()], { filename: at('Parent.svelte') });
                writeFileSync(at('Child.svelte'), javascriptChild);
                handlers.change(at('Child.svelte'));

                expect(changed).toEqual([['change', at('Parent.svelte')]]);
            }));

        // The watcher hands a change to its listeners at once, as chokidar's
        // does, this one included. A component importing itself, or two
        // importing each other while one was compiled for the other's old
        // language, handed theirs on until the stack overflowed and took the
        // dev server down.
        test.for([
            ['a component importing itself', ['Tree.svelte'], [['Tree.svelte', 'Tree.svelte']]],
            ['two importing each other', ['First.svelte', 'Second.svelte'], [['First.svelte', 'Second.svelte'], ['Second.svelte', 'First.svelte']]]
        ])('and hands on a change once, through %s', ([, names, imports]) =>
            inRoom(async ({ at }) => {
                const watcher = Object.assign(new EventEmitter(), { closed: false });
                const changed = [];
                const written = (python, child) =>
                    python
                        ? `<script lang="python">\nimportjs Child from "./${child}"\n</script>\n<p>python</p>\n`
                        : `<script>\nimport Child from './${child}';\n</script>\n<p>javascript</p>\n`;

                for (const [name, child] of imports) {
                    writeFileSync(at(name), written(true, child));
                }
                for (const [name, child] of imports) {
                    await preprocess(written(true, child), [python()], { filename: at(name) });
                }
                opened.push(watcher);
                watcher.on('change', (file) => changed.push(file));
                svelthon().configureServer({ watcher });

                for (const [name, child] of imports) {
                    writeFileSync(at(name), written(false, child));
                }
                watcher.emit('change', at(names[0]));

                expect(changed).toEqual(names.map(at));
            }));

        // Gone after the event, or no file at all, a component is read by no
        // one: the read that fails is not the dev server's to throw.
        test('and a component it cannot read changes none', () =>
            inRoom(async ({ at, compiled }) => {
                const { handlers, changed } = watching();

                await compiled('Parent.svelte');
                rmSync(at('Child.svelte'));
                mkdirSync(at('Child.svelte'));

                expect(() => handlers.change(at('Child.svelte'))).not.toThrow();
                expect(changed).toEqual([]);
            }));

        // Asked again as it was compiled, its source, its children and its
        // modules as they were, a component is left to Svelte's plugin, its
        // generated code kept: what changed is another dependency of its
        // compile, a stylesheet its `<style lang="scss">` imports, which only
        // the preprocessor that read it knows of. Handed nothing, `[]`, the
        // update was lost; its code forgotten, it was mounted anew.
        test('a component asked again as it was compiled is left to Svelte’s plugin', () =>
            inRoom(async ({ at, compiled }) => {
                const env = graph();

                await compiled('Parent.svelte');

                expect(plugin.hotUpdate.call({ environment: env }, { file: at('Parent.svelte'), modules: [{ id: 'Parent.svelte' }] })).toBeUndefined();
                expect(env.invalidated).toEqual([]);
            }));

        // An edit reaches every environment of the dev server, though the
        // client's, asked first, has the component compiled again before the
        // server's is asked.
        test('and an edit is updated in every environment, though the first one compiles it again', () =>
            inRoom(async ({ at, compiled }) => {
                const ask = () =>
                    plugin.hotUpdate
                        .call({ environment: graph() }, { file: at('Parent.svelte'), modules: [{ id: 'Parent.svelte' }], timestamp: 7 })
                        .map((one) => one.id);

                await compiled('Parent.svelte');
                writeFileSync(at('Parent.svelte'), `${parent}<p>edited</p>\n`);
                const client = ask();
                await compiled('Parent.svelte');

                expect([client, ask()].map((one) => one.includes('Parent.svelte'))).toEqual([true, true]);
            }));

        // The code depends on where each module the script imports is found:
        // its prelude evaluates that file. The watcher saw the module arrive
        // and the old file leave, and the page asked for the file no longer
        // there until the component was edited. Each component whose import is
        // found elsewhere now is changed, as an edit of its own would be; a
        // module of another name, or one found where it was, changes none.
        test.for([
            ['moved from the path to beside it', 'lib/helper.py', 'helper.py'],
            ['moved from beside it to the path', 'helper.py', 'lib/helper.py']
        ])('and the watcher changes it when a module it imports is %s', ([, from, to]) =>
            inRoom(async ({ at }) => {
                const component = '<script lang="python">\nimport helper\nvalue = helper.value\n</script>\n<p>{value}</p>\n';
                const handlers = {};
                const changed = [];
                const server = {
                    watcher: {
                        on: (event, handler) => (handlers[event] = handler),
                        emit: (event, file) => changed.push([event, file])
                    }
                };

                const shared = Symbol.for('svelthon.path');
                const kept = globalThis[shared];

                mkdirSync(at('lib'));
                writeFileSync(at('Uses.svelte'), component);
                writeFileSync(at(from), 'value = 1\n');
                await preprocess(component, [python({ path: [at('lib')] })], { filename: at('Uses.svelte') });
                globalThis[shared] = kept;
                svelthon().configureServer(server);

                writeFileSync(at('other.py'), 'value = 3\n');
                handlers.add(at('other.py'));
                writeFileSync(at('lib/helper.svelte.py'), 'value = 4\n');
                if (from === 'helper.py') handlers.add(at('lib/helper.svelte.py'));
                rmSync(at('lib/helper.svelte.py'));
                expect(changed).toEqual([]);

                writeFileSync(at(to), 'value = 2\n');
                rmSync(at(from));
                handlers.add(at(to));
                handlers.unlink(at(from));

                expect(changed).toContainEqual(['change', at('Uses.svelte')]);
            })
        );

        // And a module of Python between them, the component importing
        // `relay`, which imports `helper`: its prelude named the file no
        // longer there, and only an edit of `relay` brought the page back.
        test.for([
            ['relay.py', 'lib/helper.py', 'helper.py'],
            ['relay.svelte.py', 'helper.py', 'lib/helper.py']
        ])('and the watcher changes %s when a module it imports moves', ([relay, from, to]) =>
            inRoom(async ({ at }) => {
                const handlers = {};
                const changed = [];
                const server = {
                    watcher: {
                        on: (event, handler) => (handlers[event] = handler),
                        emit: (event, file) => changed.push([event, file])
                    }
                };
                const plugin = svelthon({ path: [at('lib')] });

                mkdirSync(at('lib'));
                writeFileSync(at(relay), 'import helper\n\n\ndef read():\n    return helper.value\n');
                writeFileSync(at(from), 'value = 1\n');
                plugin.load.call({ addWatchFile() {} }, at(relay));
                plugin.configureServer(server);

                writeFileSync(at('other.py'), 'value = 3\n');
                handlers.add(at('other.py'));
                expect(changed).toEqual([]);

                writeFileSync(at(to), 'value = 2\n');
                rmSync(at(from));
                handlers.add(at(to));
                handlers.unlink(at(from));

                expect(changed).toContainEqual(['change', at(relay)]);
            })
        );

        test('and is updated when the child changed language, or its own source', () =>
            inRoom(async ({ at, compiled, asked }) => {
                await compiled('Parent.svelte');
                writeFileSync(at('Child.svelte'), javascriptChild);
                expect(asked('Parent.svelte')).toContain('Parent.svelte');

                await compiled('Parent.svelte');
                writeFileSync(at('Parent.svelte'), `${parent}<p>more</p>\n`);
                expect(asked('Parent.svelte')).toContain('Parent.svelte');
            }));

        // Compiled as JavaScript since, it is no longer known as it was: its
        // Python source written back is an edit, the child's own update.
        test('and a component compiled as JavaScript since is updated when written back', () =>
            inRoom(async ({ at, compiled, asked }) => {
                await compiled('Child.svelte');
                writeFileSync(at('Child.svelte'), javascriptChild);
                await compiled('Child.svelte');
                writeFileSync(at('Child.svelte'), pythonChild);

                expect(asked('Child.svelte')).toContain('Child.svelte');
            }));
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
        const code = plugin.load.call({ addWatchFile() {} }, `${file}?python`);

        expect(code).toContain('$state');
        expect(code).toContain('export { __store as store };');
    });

    test('and a default export, which a route module does not have', () => {
        expect(plugin.load.call({ addWatchFile() {} }, file)).toContain('export { store as default }');
    });
});

// A component that imports a sibling `.py` gets a prelude: the module's code has
// to be evaluated before init() runs, so the import statement finds it, and its
// body is left to that statement.
describe('a component importing a module', () => {
    test('is served with the import ahead of its own body', async () => {
        const filename = resolve(fixtures, 'RootStore.svelte');

        const { code } = await preprocessed(filename);
        const served = svelthon().load('\0' + bodyOf(code));

        expect(served.code).toMatch(/^import ".*root_store\.svelte\.py\?python";$/m);

        // The prelude pays for its own lines, or every mapping points one line
        // above where it came from.
        expect(served.map.mappings.startsWith(';')).toBe(true);
    });
});
