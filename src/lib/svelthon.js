import { createRequire } from 'node:module';
import { relative, resolve, dirname } from 'node:path';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { compile, VIRTUAL_PREFIX, VFS_PREFIX } = require('./compile.cjs');

// Generated modules, keyed by component name. Filled by the preprocessor when
// Svelte transforms a component, read back when Vite resolves the import that
// the preprocessor just wrote into that component's script.
const generated = new Map();

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
function eachBlock(trimmed, openScope, call) {
    const keyed = trimmed.match(/^([\s\S]*?)\s*\(([^()]*)\)\s*$/);
    const head = keyed ? keyed[1] : trimmed;
    const parts = head.match(/^#each\s+([\s\S]+)\s+as\s+([\s\S]+)$/) || head.match(/^#each\s+([\s\S]+)$/);

    // Malformed: leave it alone and let Svelte say so in its own words.
    if (!parts) {
        openScope();
        return `{${trimmed}}`;
    }

    const iterable = call(parts[1], '__seq');
    openScope();

    return (
        `{#each ${iterable}` +
        (parts[2] ? ` as ${parts[2].trim()}` : '') +
        (keyed ? ` (${call(keyed[2], 'repr')})` : '') +
        '}'
    );
}

function pythonExpressions(markup, collect) {
    let out = '';
    let index = 0;
    let inTag = false;
    let quote = null;
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
                if (char === quote) quote = null;
            } else if (char === '"' || char === "'") {
                quote = char;
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
                        // JavaScript properties.
                        out += `{...${call(trimmed.slice(3), '')}}`;
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
                out += eachBlock(trimmed, () => scopes.push(declaredBy(trimmed)), call);
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

// The hidden functions the markup of each file needs, appended to its Python.
const templateFunctions = new Map();

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

    return {
        name: 'svelthon',
        markup({ content, filename }) {
            // The template language follows the script language, with no third
            // mode: a component without `lang="python"` is a JavaScript
            // component and stays one, exactly as a .js file is untouched by
            // TypeScript. Python semantics are opt-in, per file, by declaring
            // Python — never injected behind an author's back.
            if (!HAS_PYTHON_SCRIPT.test(content)) return;

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
                    lineOffset: lineOffsets.get(filename) ?? 0,
                    // The whole file, so a debugger opens the .svelte itself.
                    sourceContent: filename ? readFileSync(filename, 'utf8') : content
                }
            );

            // `import counter_store` in a component resolves to a .py file, its
            // own directory first, then `path`. The module has to be evaluated
            // before init() runs, so its namespace is registered by the time
            // Brython looks it up.
            const stores = imports
                .map((mod) =>
                    [dirname(filename || '.'), ...searchPath]
                        // Absolute: the prelude is emitted into a virtual
                        // module, against which a relative specifier would
                        // resolve to nothing.
                        .map((directory) => resolve(directory, `${mod}.py`))
                        .find((candidate) => existsSync(candidate))
                )
                .filter(Boolean);

            const prelude = stores.map((path) => `import ${JSON.stringify(path)};`).join('\n');

            generated.set(VIRTUAL_PREFIX + name, {
                code: `${prelude}\n${module}`,
                // A prelude line is always prepended, so every mapping shifts
                // down by one generated line.
                map: { ...map, mappings: `;${map.mappings}` }
            });
            if (stdlib) generated.set(VFS_PREFIX + name, { code: stdlib, map: null });

            return { code: script };
        }
    };
}

// Brython loads JS modules named from Python at runtime, with an `import()`
// whose argument is a variable. Vite cannot analyse that and says so, twice, on
// every start. Marking the calls keeps the vendored file byte-identical to
// upstream while silencing a warning that describes intended behaviour.
export function vendorQuirks() {
    return {
        name: 'svelthon:vendor-quirks',
        transform(code, id) {
            if (!id.endsWith('vendor/brython.js')) return;
            return { code: code.replace(/(^|[^.\w])import\(/g, '$1import(/* @vite-ignore */ '), map: null };
        }
    };
}

// A shared store is a plain .py file. It compiles to module-scope signals —
// created once for the whole application, not per component instance — and is
// served under a `.svelte.js` identity, which is what makes vite-plugin-svelte
// compile the runes inside it.
const STORE_SUFFIX = '.svelte.js';

// The demo shows how many tests back the project. Hard-coding it means letting
// it drift on every addition, so it is counted when the module is served.
const STATS_ID = VIRTUAL_PREFIX + 'stats';

// A store is served on every request in dev, and compiling Python is the
// expensive half. Keyed on mtime, so an edit still recompiles.
const compiledStores = new Map();

function compileStore(file) {
    const stamp = statSync(file).mtimeMs;
    const cached = compiledStores.get(file);
    if (cached && cached.stamp === stamp) return cached.result;

    const source = readFileSync(file, 'utf8');
    const result = compile(source, nameFor(file), relative(process.cwd(), file), {
        store: true,
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

// The Vite plugin that serves those modules.
export function svelthon() {
    const isVirtual = (id) => id.startsWith(VIRTUAL_PREFIX) || id.startsWith(VFS_PREFIX);
    const isStore = (id) => id.endsWith('.py' + STORE_SUFFIX);

    return {
        name: 'svelthon:modules',
        // 'pre', or Vite's own resolver claims `./store.py` as a plain file and
        // hands its Python straight to the JS parser.
        enforce: 'pre',
        resolveId(id, importer) {
            if (isVirtual(id)) return '\0' + id;
            if (id.endsWith('.py') && importer) {
                return resolve(dirname(importer), id) + STORE_SUFFIX;
            }
        },
        load(id) {
            if (id === '\0' + STATS_ID) return `export const tests = ${countTests()};`;

            if (id.startsWith('\0')) {
                const entry = generated.get(id.slice(1));
                return entry && (entry.map ? { code: entry.code, map: entry.map } : entry.code);
            }
            if (!isStore(id)) return;

            const file = id.slice(0, -STORE_SUFFIX.length);
            const name = nameFor(file);
            const { script, module, map, stdlib } = compileStore(file);

            generated.set(VIRTUAL_PREFIX + name, { code: module, map });
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
            const name = nameFor(file);
            if (!generated.has(VIRTUAL_PREFIX + name)) return;

            const graph = this.environment.moduleGraph;
            const stale = [];

            const forget = (id) => {
                const mod = graph.getModuleById(id);
                if (mod) {
                    graph.invalidateModule(mod);
                    stale.push(mod);
                }
            };

            for (const prefix of [VIRTUAL_PREFIX, VFS_PREFIX]) forget('\0' + prefix + name);

            // A store's .py is watched, not imported: its compiled module is
            // served under a different id, and unless that one is invalidated too
            // its load() never reruns — leaving `generated` holding the previous
            // body, exactly the staleness this hook exists to prevent.
            if (file.endsWith('.py')) forget(file + STORE_SUFFIX);

            return [...modules, ...stale];
        }
    };
}
