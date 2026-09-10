import { createRequire } from 'node:module';
import { relative, resolve, dirname } from 'node:path';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
    overMarkup,
    pythonExpressions,
    collector,
    moduleImports,
    directiveModules
} from './markup.js';

const require = createRequire(import.meta.url);
const { compile, VIRTUAL_PREFIX, virtualId } = require('./compile.cjs');

// Generated modules, keyed by component name. Filled by the preprocessor when
// Svelte transforms a component, read back when Vite resolves the import that
// the preprocessor just wrote into that component's script.
//
// Held on a global registry rather than in this module, because the two halves
// do not always land in the same module instance: SvelteKit loads
// `svelte.config.js` (where the preprocessor is declared) through its own
// loader, while Vite bundles `vite.config.js`, where the plugin is. This file
// is then evaluated twice, and a module-level Map would leave the plugin
// looking in an empty one.
const generated = (globalThis[Symbol.for('svelthon.generated')] ??= new Map());

// Must be unique across the project *and* a valid JS identifier, since Brython
// derives its namespace binding (`locals_<name>`) from it.
const nameFor = (filename) => relative(process.cwd(), filename || 'Component').replace(/\W/g, '_');

const HAS_PYTHON_SCRIPT = /<script[^>]*\blang=["']python["']/;
// Python line numbers count from the start of the <script> body; the file counts
// from its first line. The gap is the number of lines before the opening tag.
const lineOffsets = new Map();

// The hidden functions the markup of each file needs, appended to its Python.
const templateFunctions = new Map();

const jsNames = new Map();

// The Python modules each file names in a directive, which is the one place a
// module needs a JavaScript binding of its own.
const pyDirectives = new Map();

// One collector per file, keeping the definitions where the script hook will
// find them. The collector itself is in markup.js, which the browser can load.
function fileCollector(filename) {
    const defs = [];
    templateFunctions.set(filename, defs);
    return collector(defs);
}

// The Svelte preprocessor: runs before Svelte parses the component, so the
// compiler only ever sees ordinary JavaScript with runes.
// `path` mirrors PYTHONPATH: the directories searched for the `.py` a component
// imports, after its own. Without it, `import counter_store` only ever resolves
// to a sibling file, and a component that reached the module some other way
// would appear to work purely by load order.
export function python(options = {}) {
    const searchPath = options.path || [];

    // Shared with the plugin, which compiles the `.py` files themselves and has
    // to resolve their imports the same way. The two halves may not be the same
    // module instance. See the registry above.
    globalThis[Symbol.for('svelthon.path')] = searchPath;

    return {
        name: 'svelthon',
        markup({ content, filename }) {
            // The template language follows the script language, with no third
            // mode: a component without `lang="python"` is a JavaScript
            // component and stays one, exactly as a .js file is untouched by
            // TypeScript. Python semantics are opt-in, per file, by declaring
            // Python, never injected behind an author's back.
            if (!HAS_PYTHON_SCRIPT.test(content)) return;

            jsNames.set(filename, moduleImports(content));
            pyDirectives.set(filename, directiveModules(content));
            lineOffsets.set(
                filename,
                content.slice(0, content.search(HAS_PYTHON_SCRIPT)).split('\n').length - 1
            );

            const collect = fileCollector(filename);

            return {
                code: overMarkup(content, (markup, offset) =>
                    // The chunk, and where it starts, so a refusal can name a
                    // line and a column in the file the author is looking at.
                    pythonExpressions(markup, collect)
                )
            };
        },
        script({ content, attributes, filename }) {
            if (attributes.lang !== 'python') return;

            const name = nameFor(filename);
            const { script, module, map, imports } = compile(
                content,
                name,
                relative(process.cwd(), filename || 'Component'),
                {
                    defs: templateFunctions.get(filename) || [],
                    jsNames: jsNames.get(filename) ?? [],
                    pyDirectives: pyDirectives.get(filename) ?? [],
                    lineOffset: lineOffsets.get(filename) ?? 0,
                    // The whole file, so a debugger opens the .svelte itself.
                    sourceContent: filename ? readFileSync(filename, 'utf8') : content
                }
            );

            // `import counter_store` in a component resolves to a .py file, its
            // own directory first, then `path`. The module has to be evaluated
            // before init() runs, so its namespace is registered by the time
            // Brython looks it up.
            const prelude = pythonImports(imports, dirname(filename || '.'));

            generated.set(virtualId(name), withPrelude(module, map, prelude));

            // The content is JavaScript now, so the tag must stop claiming
            // otherwise. Leaving `lang="python"` in place is invisible to the
            // Svelte compiler, which parses the content as JavaScript either
            // way, but every tool downstream reads the attribute and refuses:
            // `svelte-check`, installed by 93% of SvelteKit projects, reported
            // dozens of parse errors per component until this line existed.
            const { lang, ...rest } = attributes;

            return { code: script, attributes: rest };
        }
    };
}

// The demo shows how many tests back the project. Hard-coding it means letting
// it drift on every addition, so it is counted when the module is served.
const STATS_ID = virtualId('stats');

// A store is served on every request in dev, and compiling Python is the
// expensive half. Keyed on mtime, so an edit still recompiles.
const compiledStores = new Map();

// A shared store is a plain .py file. It compiles to module-scope signals,
// created once for the whole application rather than per component instance,
// and is served under a `.svelte.js` identity, which is what makes
// vite-plugin-svelte compile the runes inside it.
function compilePython(file) {
    const stamp = statSync(file).mtimeMs;
    const cached = compiledStores.get(file);
    if (cached && cached.stamp === stamp) return cached.result;

    const source = readFileSync(file, 'utf8');
    const mode = isReactive(file) ? { store: true } : { plain: true };
    const result = compile(source, nameFor(file), relative(process.cwd(), file), {
        ...mode,
        sourceContent: source
    });

    compiledStores.set(file, { stamp, result });
    return result;
}

const countTests = () =>
    readdirSync('tests')
        .filter((name) => name.endsWith('.test.js'))
        .reduce(
            (total, name) =>
                // Anchored: a `/re/.test(x)` elsewhere in a file is not a test,
                // and `test.fails()`, the failures we expect, is one.
                total + (readFileSync(`tests/${name}`, 'utf8').match(/^\s*test(\.fails)?\(/gm) || []).length,
            0
        );

// The generated module, behind the imports it needs evaluated first.
//
// A source map's `mappings` is delta-encoded per generated line, lines separated
// by `;`, so the prelude costs one `;` per line it adds: get that wrong and a
// debugger opens the file that many lines off. A module importing nothing is
// left alone rather than gaining an empty first line.
export function withPrelude(module, map, prelude) {
    if (!prelude) return { code: module, map };

    const lead = `${prelude}\n`;
    const lines = lead.split('\n').length - 1;

    return { code: lead + module, map: { ...map, mappings: ';'.repeat(lines) + map.mappings } };
}

// `import peps` names a file, looked up in the importer's own directory first,
// then along the configured path. Both spellings are tried, since the statement
// says nothing about whether the module it names is reactive.
function pythonImports(names, fromDirectory) {
    const searchPath = globalThis[Symbol.for('svelthon.path')] || [];

    return names
        .flatMap((mod) =>
            [fromDirectory, ...searchPath]
                .flatMap((directory) => [
                    resolve(directory, `${mod}.svelte.py`),
                    resolve(directory, `${mod}.py`)
                ])
                .find((candidate) => existsSync(candidate)) || []
        )
        .map((path) => `import ${JSON.stringify(path)};`)
        .join('\n');
}

// Python follows TypeScript's own convention, the one Svelte already defines:
// `foo.ts` is an ordinary module and `foo.svelte.ts` is a reactive one. So
// `foo.py` compiles to ordinary JavaScript, and `foo.svelte.py` to a rune
// module whose names become signals.
//
// A rune module is only compiled by the Svelte plugin if its name matches that
// plugin's own filter, which is configurable, and which the project widens:
//
//     svelte({ experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } } })
//
// The filter is an infix (`.svelte.`) followed by one of those extensions, so
// `panier.svelte.py` matches and `peps.py` does not, exactly the line we wanted
// to draw. Both keep their own path, which is also what lets SvelteKit find a
// `+page.server.py` in Vite's manifest, where it looks it up by the name it
// wrote.
const isReactive = (file) => file.endsWith('.svelte.py');

// The Vite plugin that serves those modules.
export function svelthon() {
    const isVirtual = (id) => id.startsWith(VIRTUAL_PREFIX);

    return {
        name: 'svelthon:modules',
        // 'pre', or Vite's own resolver claims `./store.py` as a plain file and
        // hands its Python straight to the JS parser.
        enforce: 'pre',
        resolveId(id, importer) {
            if (isVirtual(id)) return '\0' + id;
            // Without an importer either: SvelteKit hands its route modules to
            // Vite as already-resolved entries, with nobody to resolve against.
            // Only a path we can resolve ourselves. A bare or aliased specifier
            // such as `#lib/peps.py` belongs to whoever defined the alias, and
            // reaches load() as an absolute path once they have.
            if (id.endsWith('.py') && (id.startsWith('.') || id.startsWith('/'))) {
                const direct = importer ? resolve(dirname(importer), id) : resolve(id);
                if (existsSync(direct)) return direct;

                // A leading slash means two different things. An alias has
                // already produced a real filesystem path; SvelteKit's own route
                // entries are relative to the **project root**,
                // `/src/routes/+page.server.py`, which no filesystem has. Note
                // that `resolve(dir, '/x')` ignores `dir` entirely, so having an
                // importer does not help here: only trying the file tells the
                // two apart, and getting it wrong reads as
                // `ENOENT: stat '/src/routes/+page.server.py'`.
                if (id.startsWith('/')) {
                    const fromRoot = resolve(process.cwd(), `.${id}`);
                    if (existsSync(fromRoot)) return fromRoot;
                }

                return direct;
            }
        },
        load(id) {
            if (id === '\0' + STATS_ID) return `export const tests = ${countTests()};`;

            if (id.startsWith('\0')) {
                const entry = generated.get(id.slice(1));
                return entry && (entry.map ? { code: entry.code, map: entry.map } : entry.code);
            }
            if (!id.endsWith('.py')) return;

            const file = id;
            const name = nameFor(file);
            const { script, module, map, imports } = compilePython(file);

            // A `.py` may import another one, a route module reaching for its
            // data layer. Same prelude a component gets.
            const prelude = pythonImports(imports, dirname(file));

            generated.set(virtualId(name), withPrelude(module, map, prelude));

            this.addWatchFile(file);
            return script;
        },

        // A component's generated code lives in its own module, which Vite has
        // no reason to tie to the .svelte file that produced it. Without
        // this, editing the Python re-transforms the component but keeps
        // serving the previous generated body: the page updates to code that
        // never changed.
        //
        // Order holds on its own: the browser refetches the component first,
        // which re-runs the preprocessor and refreshes `generated`, and only
        // then follows its import to the virtual module.
        hotUpdate({ file, modules }) {
            const graph = this.environment.moduleGraph;
            const stale = [];

            const forget = (id) => {
                const mod = graph.getModuleById(id);
                if (mod) {
                    graph.invalidateModule(mod);
                    stale.push(mod);
                }
            };

            // The test count is read from the filesystem once, and the module
            // holding it depends on no file Vite can see, so nothing would ever
            // invalidate it, and the page would keep showing a stale number.
            if (file.endsWith('.test.js')) {
                forget('\0' + STATS_ID);
                return [...modules, ...stale];
            }

            const name = nameFor(file);
            if (!generated.has(virtualId(name))) return;

            forget('\0' + virtualId(name));

            // A store's .py is watched, not imported, so its own module has to
            // be invalidated too, otherwise its load() never reruns and
            // `generated` keeps the previous body, exactly the staleness this
            // hook exists to prevent.
            if (file.endsWith('.py')) forget(file);

            return [...modules, ...stale];
        }
    };
}
