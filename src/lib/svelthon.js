import { createRequire } from 'node:module';
import { relative, resolve, dirname } from 'node:path';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

// Find the '}' closing the block that opens at `start`, ignoring braces inside
// string literals.
function closingBrace(source, start) {
    let depth = 0;
    let quote = null;

    for (let i = start; i < source.length; i++) {
        const c = source[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'" || c === '`') quote = c;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return i;
    }

    return -1;
}

// Only the markup, never a <script> or <style> body — Python is full of braces
// (dict literals, f-strings) and rewriting them would be catastrophic.
function overMarkup(content, transform) {
    const blocks = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
    let out = '';
    let cut = 0;
    let block;

    while ((block = blocks.exec(content))) {
        out += transform(content.slice(cut, block.index)) + block[0];
        cut = block.index + block[0].length;
    }

    return out + transform(content.slice(cut));
}

// Directives carry a callback or a JavaScript value, never a rendering, so they
// keep the host language: `onclick={increment}`, `bind:value={name}`,
// `use:action={opts}`, the transition family. Every other attribute — including
// a component prop — carries a Python value and is compiled as one.
const DIRECTIVE = /^(?:on[a-z]|(?:on|use|bind|transition|animate|in|out|class|style):)/;

// Names a block introduces, which are not module globals and must therefore be
// passed in as arguments.
const BLOCK_NAMES = {
    '#each': /\bas\s+([^()]*?)\s*(?:\(|$)/,
    '#snippet': /\w+\s*\(([^)]*)\)/,
    ':then': /^:then\s+(.+)$/,
    ':catch': /^:catch\s+(.+)$/,
    '@const': /^@const\s+([^=]+)=/
};

const identifiers = (text) => [...text.matchAll(/[A-Za-z_]\w*/g)].map((m) => m[0]);

function declaredBy(inner) {
    const keyword = inner.trimStart().split(/[\s(]/)[0];
    const pattern = BLOCK_NAMES[keyword];
    if (!pattern) return [];

    const found = inner.trim().match(pattern);
    return found ? identifiers(found[1]) : [];
}

// `{#each xs as x, i (key)}`. The iterable is evaluated outside the block, so it
// is compiled before the block's names exist; the key is evaluated inside it.
// Both matter: a Python iterable that is not a list — a dict, a range, the
// result of .items() — has to become an array for Svelte to walk it.
// `for k, v in d.items()` is how Python unpacks, and `as (k, v)` is how it reads
// in a template. Svelte destructures with brackets — and a Python tuple *is* an
// array, so the two mean the same thing once the punctuation is translated.
function pattern(target) {
    const trimmed = target.trim();

    // Only what is explicitly parenthesised. A bare `x, i` is Svelte's item and
    // index, not a tuple — turning that into `[x, i]` would silently destructure
    // every indexed loop in the project.
    if (!trimmed.startsWith('(')) return trimmed;

    let depth = 0;
    let close = -1;

    for (let i = 0; i < trimmed.length && close === -1; i++) {
        if (trimmed[i] === '(') depth++;
        else if (trimmed[i] === ')' && --depth === 0) close = i;
    }

    if (close === -1) return trimmed;

    const inner = trimmed.slice(1, close).replace(/[()]/g, (one) => (one === '(' ? '[' : ']'));
    return `[${inner}]${trimmed.slice(close + 1)}`;
}

function eachBlock(trimmed, declare, call) {
    const split = trimmed.match(/^#each\s+([\s\S]+?)\s+as\s+([\s\S]+)$/);

    // No `as`: nothing is declared, and there is no key to find either.
    if (!split) {
        const alone = trimmed.match(/^#each\s+([\s\S]+)$/);
        declare([]);
        return alone ? `{#each ${call(alone[1], '__seq')}}` : `{${trimmed}}`;
    }

    // A key trails the target, so the part before it has to be non-empty —
    // otherwise `as (statut, combien)` would read as a key with no target.
    const keyed = split[2].match(/^([\s\S]*\S)\s*\(([^()]*)\)\s*$/);
    const target = pattern(keyed ? keyed[1] : split[2]);

    const iterable = call(split[1], '__seq');
    declare(identifiers(target));

    return `{#each ${iterable} as ${target}` + (keyed ? ` (${call(keyed[2], 'repr')})` : '') + '}';
}

function pythonExpressions(markup, collect) {
    let out = '';
    let index = 0;
    let inTag = false;
    let quote = null;
    let quotedAttribute = null;
    const scopes = [];

    const inScope = () => [...new Set(scopes.flat())];

    const call = (expr, wrapper) => {
        const args = inScope();
        const name = collect(expr.trim(), wrapper, args);

        // follow() on the block's own names: a row of an {#each} is a plain
        // JavaScript value, not a signal, so reading `it.label` registers
        // nothing by itself. This is what subscribes the row's block to the row.
        return `${name}(${args.map((arg) => `follow(${arg})`).join(', ')})`;
    };

    while (index < markup.length) {
        const char = markup[index];

        if (inTag) {
            if (quote) {
                // `class="badge {statut.lower()}"` — an interpolation inside a
                // quoted attribute value. Svelte concatenates it into a string,
                // so it renders like any other text and goes through __text.
                if (char === '{') {
                    const end = closingBrace(markup, index);

                    if (end !== -1 && !DIRECTIVE.test(quotedAttribute || '')) {
                        out += `{${call(markup.slice(index + 1, end), '__text')}}`;
                        index = end + 1;
                        continue;
                    }
                }

                if (char === quote) quote = null;
            } else if (char === '"' || char === "'") {
                quote = char;
                quotedAttribute = (out.match(/([^\s=]+)=$/) || [])[1];
            } else if (char === '{') {
                const end = closingBrace(markup, index);
                if (end !== -1) {
                    const attribute = out.match(/([^\s=]+)=$/);
                    const inner = markup.slice(index + 1, end);
                    const trimmed = inner.trim();

                    if (attribute) {
                        // A directive carries a callback or a JavaScript value;
                        // every other named attribute, component prop included,
                        // carries a Python one.
                        out += DIRECTIVE.test(attribute[1])
                            ? markup.slice(index, end + 1)
                            : `{${call(inner, '')}}`;
                    } else if (trimmed.startsWith('...')) {
                        // {...attrs} — spreading a Python dict, whose keys are
                        // JavaScript properties. A shallow copy, so that Svelte's
                        // diff against the previous render sees a mutation: this
                        // is what a JavaScript spread does by itself.
                        out += `{...${call(trimmed.slice(3), '__spread')}}`;
                    } else if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
                        // {name}, Svelte's shorthand for name={name}. Expanding
                        // it is what routes the read through the namespace, and
                        // therefore through the accessor.
                        out += `${trimmed}={${call(trimmed, '')}}`;
                    } else {
                        out += markup.slice(index, end + 1);
                    }

                    index = end + 1;
                    continue;
                }
            } else if (char === '>') {
                inTag = false;
            }

            out += char;
            index++;
            continue;
        }

        if (char === '<') {
            // An HTML comment is not a tag. Quotes mean nothing inside one, and
            // an apostrophe — `aujourd'hui` — would otherwise open a string that
            // never closes, silently leaving the whole rest of the template in
            // JavaScript.
            if (markup.startsWith('<!--', index)) {
                const close = markup.indexOf('-->', index);
                const stop = close === -1 ? markup.length : close + 3;

                out += markup.slice(index, stop);
                index = stop;
                continue;
            }

            inTag = true;
            out += char;
            index++;
            continue;
        }

        if (char !== '{') {
            out += char;
            index++;
            continue;
        }

        const end = closingBrace(markup, index);
        if (end === -1) {
            out += char;
            index++;
            continue;
        }

        const inner = markup.slice(index + 1, end);
        const trimmed = inner.trim();

        if (trimmed.startsWith('#')) {
            if (trimmed.startsWith('#if ')) {
                scopes.push([]);
                out += `{#if ${call(trimmed.slice(4), '__truthy')}}`;
            } else if (trimmed.startsWith('#each ')) {
                out += eachBlock(trimmed, (names) => scopes.push(names), call);
            } else if (trimmed.startsWith('#key ')) {
                // Svelte re-creates the block when the value changes, by
                // identity — which no Python value keeps. repr() gives one.
                scopes.push([]);
                out += `{#key ${call(trimmed.slice(5), 'repr')}}`;
            } else {
                scopes.push(declaredBy(trimmed));
                out += markup.slice(index, end + 1);
            }
        } else if (trimmed.startsWith('/')) {
            scopes.pop();
            out += markup.slice(index, end + 1);
        } else if (trimmed.startsWith(':')) {
            // A continuation clause may rebind the block's names.
            const declared = declaredBy(trimmed);
            if (declared.length) scopes[scopes.length - 1] = declared;

            out += /^:else\s+if\s/.test(trimmed)
                ? `{:else if ${call(trimmed.replace(/^:else\s+if\s/, ''), '__truthy')}}`
                : markup.slice(index, end + 1);
        } else if (trimmed.startsWith('@')) {
            const assigned = trimmed.match(/^@const\s+([^=]+)=([\s\S]+)$/);

            if (assigned) {
                // Compiled before the name it declares enters scope: a const may
                // read the block's names and the consts before it, never itself.
                out += `{@const ${assigned[1].trim()} = ${call(assigned[2], '')}}`;
                scopes[scopes.length - 1]?.push(...declaredBy(trimmed));
            } else if (trimmed.startsWith('@html ')) {
                out += `{@html ${call(trimmed.slice(6), '__text')}}`;
            } else {
                // {@render} calls a snippet, which is a JavaScript function, and
                // {@debug} takes names rather than an expression.
                out += markup.slice(index, end + 1);
            }
        } else {
            out += `{${call(inner, '__text')}}`;
        }

        index = end + 1;
    }

    return out;
}

const HAS_PYTHON_SCRIPT = /<script[^>]*\blang=["']python["']/;
// Python line numbers count from the start of the <script> body; the file counts
// from its first line. The gap is the number of lines before the opening tag.
const lineOffsets = new Map();

// Names a component imports in its `<script module>`. They live in JavaScript,
// and Python cannot import them — but they are in scope for the generated code,
// so publishing them into the namespace makes them readable from Python. That
// is what lets a Python component reach `page` from `$app/state`, or any npm
// library at all.
const MODULE_SCRIPT = /<script[^>]*\b(?:module|context=["']module["'])[^>]*>([\s\S]*?)<\/script>/i;
const IMPORT = /import\s+([\s\S]*?)\s+from\s+['"]/g;

// Whatever the block declares in its own right — a constant, a helper, a class.
const DECLARED = /^\s*(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;

function moduleImports(content) {
    const block = content.match(MODULE_SCRIPT);
    if (!block) return [];

    const names = [];
    let one;

    while ((one = IMPORT.exec(block[1]))) {
        const clause = one[1];
        const braced = clause.match(/\{([\s\S]*)\}/);

        // `import Default, { a as b }` — the part before the brace is a default
        // binding, and each entry inside is renamed by its own `as`.
        for (const piece of (braced ? clause.slice(0, braced.index) : clause).split(',')) {
            const bare = piece.replace(/\*\s*as\s+/, '').trim();
            if (/^[A-Za-z_$][\w$]*$/.test(bare)) names.push(bare);
        }

        if (braced) {
            for (const entry of braced[1].split(',')) {
                const local = entry.split(/\s+as\s+/).pop().trim();
                if (/^[A-Za-z_$][\w$]*$/.test(local)) names.push(local);
            }
        }
    }

    let declaration;
    while ((declaration = DECLARED.exec(block[1]))) names.push(declaration[1]);

    return [...new Set(names)];
}

// The hidden functions the markup of each file needs, appended to its Python.
const templateFunctions = new Map();

const jsNames = new Map();

// Appended, never prepended: the Python's own line numbers stay true, which is
// what keeps error messages and source maps pointing at the right place.
function collector(filename) {
    const defs = [];
    const seen = new Map();

    templateFunctions.set(filename, defs);

    return (expression, wrapper, args) => {
        const key = `${wrapper}|${args.join(',')}|${expression}`;
        if (seen.has(key)) return seen.get(key);

        const name = `__expr_${defs.length}`;
        seen.set(key, name);
        defs.push(
            `def ${name}(${args.join(', ')}):\n    return ${wrapper ? `${wrapper}(${expression})` : expression}`
        );
        return name;
    };
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

            const collect = collector(filename);
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
