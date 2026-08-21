import { createRequire } from 'node:module';
import { relative, resolve, dirname } from 'node:path';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { overMarkup, pythonExpressions, collector, moduleImports } from './markup.js';

const require = createRequire(import.meta.url);
const { compile, VIRTUAL_PREFIX, VFS_PREFIX } = require('./compile.cjs');

// Generated modules, keyed by component name. Filled by the preprocessor when
// Svelte transforms a component, read back when Vite resolves the import that
// the preprocessor just wrote into that component's script.
//
// Held on a global registry rather than in this module, because the two halves
// do not always land in the same module instance: SvelteKit loads
// `svelte.config.js` — where the preprocessor is declared — through its own
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

// Appended, never prepended: the Python's own line numbers stay true, which is
// what keeps error messages and source maps pointing at the right place.
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
// to a sibling file — and a component that reached the module some other way
// would appear to work purely by load order.
export function python(options = {}) {
    const searchPath = options.path || [];

    // Shared with the plugin, which compiles the `.py` files themselves and has
    // to resolve their imports the same way. The two halves may not be the same
    // module instance — see the registry above.
    globalThis[Symbol.for('svelthon.path')] = searchPath;

    return {
        name: 'svelthon',
        markup({ content, filename }) {
            // The template language follows the script language, with no third
            // mode: a component without `lang="python"` is a JavaScript
            // component and stays one, exactly as a .js file is untouched by
            // TypeScript. Python semantics are opt-in, per file, by declaring
            // Python — never injected behind an author's back.
            if (!HAS_PYTHON_SCRIPT.test(content)) return;

            jsNames.set(filename, moduleImports(content));
            lineOffsets.set(
                filename,
                content.slice(0, content.search(HAS_PYTHON_SCRIPT)).split('\n').length - 1
            );

            const collect = fileCollector(filename);
            return { code: overMarkup(content, (markup) => pythonExpressions(markup, collect)) };
        },
        script({ content, attributes, filename }) {
            if (attributes.lang !== 'python') return;

            const name = nameFor(filename);
            const defs = templateFunctions.get(filename) || [];
            const source = defs.length ? `${content}\n${defs.join('\n\n')}\n` : content;

            const { script, module, map, stdlib, imports } = compile(
                source,
                name,
                relative(process.cwd(), filename || 'Component'),
                {
                    jsNames: jsNames.get(filename) ?? [],
                    lineOffset: lineOffsets.get(filename) ?? 0,
                    // The whole file, so a debugger opens the .svelte itself.
                    sourceContent: filename ? readFileSync(filename, 'utf8') : content
                }
            );

            // `import counter_store` in a component resolves to a .py file, its
            // own directory first, then `path`. The module has to be evaluated
            // before init() runs, so its namespace is registered by the time
            // Brython looks it up.
            // The imported modules have to be evaluated before init() runs, so
            // their namespaces are registered by the time Brython looks them up.
            const prelude = pythonImports(imports, dirname(filename || '.'));

            generated.set(VIRTUAL_PREFIX + name, {
                code: `${prelude}\n${module}`,
                // A prelude line is always prepended, so every mapping shifts
                // down by one generated line.
                map: { ...map, mappings: `;${map.mappings}` }
            });
            if (stdlib) generated.set(VFS_PREFIX + name, { code: stdlib, map: null });

            // The content is JavaScript now, so the tag must stop claiming
            // otherwise. Leaving `lang="python"` in place is invisible to the
            // Svelte compiler, which parses the content as JavaScript either
            // way — but every tool downstream reads the attribute and refuses:
            // `svelte-check`, installed by 93% of SvelteKit projects, reported
            // dozens of parse errors per component until this line existed.
            const { lang, ...rest } = attributes;

            return { code: script, attributes: rest };
        }
    };
}

// Defects in the vendored Brython, repaired as it is served rather than in the
// file. `vendor/brython.js` therefore stays byte-identical to the upstream
// build, and dropping a newer one in makes a patch that no longer matches fail
// loudly at build time instead of silently doing nothing.
//
// Each of these is described in BRYTHON.md, which is also where the ones we
// decided *not* to patch are written down, with the reason.
const VENDOR_PATCHES = [
    {
        // A debug print left in, firing on every attribute access on a
        // JavaScript class from Python — `js.Response.new` is enough — and
        // dumping the whole class object each time.
        what: 'debug console.log in $B.JSClass.tp_getattro',
        find: "$B.JSClass.tp_getattro=function(self,attr){console.log('JSClass getatro',self,attr)\n",
        replace: '$B.JSClass.tp_getattro=function(self,attr){\n',
        times: 1
    },

    // Converting a container to JavaScript leaves a back-reference on the
    // result — `jsobj[PYOBJ] = pyobj` — which any Web API taking a WebIDL
    // record then refuses, because a record conversion rejects an own symbol
    // key. `new Response(body, {headers})` is the everyday case. The
    // back-reference is a round-trip cache, so a WeakMap keyed by the JavaScript
    // object serves exactly the same purpose while leaving the object clean.
    //
    // The symbol itself stays defined: it is published as `$B.PYOBJ`, and
    // nothing outside these sites should start reading an empty slot.
    {
        what: 'the PYOBJ back-reference: declare the WeakMap beside the symbol',
        find: "const PYOBJ=$B.PYOBJ=Symbol('PYOBJ')\n",
        replace: "const PYOBJ=$B.PYOBJ=Symbol('PYOBJ')\nconst PYOBJ_MAP=$B.$svelthonPyobj=new WeakMap()\n",
        times: 1
    },
    {
        what: 'the PYOBJ back-reference: the DOM node write',
        find: 'jsobj[PYOBJ]=res\n',
        replace: 'PYOBJ_MAP.set(jsobj,res)\n',
        times: 1
    },
    {
        what: 'the PYOBJ back-reference: the list, dict, function and coroutine writes',
        find: 'jsobj[PYOBJ]=pyobj\n',
        replace: 'PYOBJ_MAP.set(jsobj,pyobj)\n',
        times: 4
    },
    {
        what: 'the PYOBJ back-reference: the read in jsobj2pyobj',
        find: 'let pyobj=jsobj[PYOBJ]\n',
        replace: 'let pyobj=PYOBJ_MAP.get(jsobj)\n',
        times: 1
    },
    {
        what: 'the PYOBJ back-reference: the read in list_eq',
        find: 'if(other[$B.PYOBJ]){other=other[$B.PYOBJ]}',
        replace: 'if($B.$svelthonPyobj.get(other)){other=$B.$svelthonPyobj.get(other)}',
        times: 1
    },
    {
        what: 'the PYOBJ back-reference: the read in js_array.append',
        find: 'if(self[PYOBJ]){self[PYOBJ].push(x)}',
        replace: 'if(PYOBJ_MAP.get(self)){PYOBJ_MAP.get(self).push(x)}',
        times: 1
    },
    {
        what: 'the PYOBJ back-reference: the read in the attribute lookup',
        find: 'if(Object.hasOwn(res,$B.PYOBJ)){return res[$B.PYOBJ]}',
        replace: 'if($B.$svelthonPyobj.has(res)){return $B.$svelthonPyobj.get(res)}',
        times: 1
    }
];

// Brython also loads JS modules named from Python at runtime, with an `import()`
// whose argument is a variable. Vite cannot analyse that and says so, twice, on
// every start. Marking the calls silences a warning that describes intended
// behaviour.
export function vendorQuirks() {
    return {
        name: 'svelthon:vendor-quirks',
        transform(code, id) {
            if (!id.endsWith('vendor/brython.js')) return;

            let patched = code.replace(/(^|[^.\w])import\(/g, '$1import(/* @vite-ignore */ ');

            for (const patch of VENDOR_PATCHES) {
                const found = patched.split(patch.find).length - 1;

                if (found !== patch.times) {
                    throw new Error(
                        `svelthon: the vendored Brython patch for ${patch.what} matched ` +
                            `${found} time(s), expected ${patch.times}. The vendored build has ` +
                            `changed — check BRYTHON.md and update the patch.`
                    );
                }

                patched = patched.split(patch.find).join(patch.replace);
            }

            return { code: patched, map: null };
        }
    };
}

// A shared store is a plain .py file. It compiles to module-scope signals —
// created once for the whole application, not per component instance — and is
// served under a `.svelte.js` identity, which is what makes vite-plugin-svelte
// compile the runes inside it.
// The demo shows how many tests back the project. Hard-coding it means letting
// it drift on every addition, so it is counted when the module is served.
const STATS_ID = VIRTUAL_PREFIX + 'stats';

// A store is served on every request in dev, and compiling Python is the
// expensive half. Keyed on mtime, so an edit still recompiles.
const compiledStores = new Map();

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
                // and `test.fails()` — the failures we expect — is one.
                total + (readFileSync(`tests/${name}`, 'utf8').match(/^\s*test(\.fails)?\(/gm) || []).length,
            0
        );

// `import peps` → the file it names, looked up in the importer's own directory
// first, then along the configured path. Both spellings are tried, since the
// statement says nothing about whether the module it names is reactive.
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
// plugin's own filter — which is configurable, and which the project widens:
//
//     svelte({ experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } } })
//
// The filter is an infix (`.svelte.`) followed by one of those extensions, so
// `panier.svelte.py` matches and `peps.py` does not — exactly the line we wanted
// to draw. Both keep their own path, which is also what lets SvelteKit find a
// `+page.server.py` in Vite's manifest, where it looks it up by the name it
// wrote.
const isReactive = (file) => file.endsWith('.svelte.py');

// The Vite plugin that serves those modules.
export function svelthon() {
    const isVirtual = (id) => id.startsWith(VIRTUAL_PREFIX) || id.startsWith(VFS_PREFIX);

    return {
        name: 'svelthon:modules',
        // 'pre', or Vite's own resolver claims `./store.py` as a plain file and
        // hands its Python straight to the JS parser.
        enforce: 'pre',
        resolveId(id, importer) {
            if (isVirtual(id)) return '\0' + id;
            // Without an importer either: SvelteKit hands its route modules to
            // Vite as already-resolved entries, with nobody to resolve against.
            // Only a path we can resolve ourselves. A bare or aliased specifier —
            // `#lib/peps.py` — belongs to whoever defined the alias, and reaches
            // load() as an absolute path once they have.
            if (id.endsWith('.py') && (id.startsWith('.') || id.startsWith('/'))) {
                return importer ? resolve(dirname(importer), id) : resolve(id);
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
            const { script, module, map, stdlib, imports } = compilePython(file);

            // A `.py` may import another one — a route module reaching for its
            // data layer. Same prelude a component gets.
            const prelude = pythonImports(imports, dirname(file));

            generated.set(VIRTUAL_PREFIX + name, {
                code: prelude ? `${prelude}\n${module}` : module,
                map: prelude ? { ...map, mappings: `;${map.mappings}` } : map
            });
            if (stdlib) generated.set(VFS_PREFIX + name, { code: stdlib, map: null });

            this.addWatchFile(file);
            return script;
        },

        // A component's generated code lives in its own module, which Vite has
        // no reason to tie to the .svelte file that produced it. Without
        // this, editing the Python re-transforms the component but keeps
        // serving the previous generated body: the page updates to code that
        // never changed.
        //
        // Order holds on its own — the browser refetches the component first,
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
            // holding it depends on no file Vite can see — so nothing would ever
            // invalidate it, and the page would keep showing a stale number.
            if (file.endsWith('.test.js')) {
                forget('\0' + STATS_ID);
                return [...modules, ...stale];
            }

            const name = nameFor(file);
            if (!generated.has(VIRTUAL_PREFIX + name)) return;

            for (const prefix of [VIRTUAL_PREFIX, VFS_PREFIX]) forget('\0' + prefix + name);

            // A store's .py is watched, not imported, so its own module has to
            // be invalidated too — otherwise its load() never reruns and
            // `generated` keeps the previous body, exactly the staleness this
            // hook exists to prevent.
            if (file.endsWith('.py')) forget(file);

            return [...modules, ...stale];
        }
    };
}
