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

// Text interpolation is `String(value)`, which renders a Python list as `a,b,c`
// and a dict as `[object Object]`. Lists are literally JS arrays, so no
// prototype can be patched — the interpolation itself has to go through
// Python's str(). Attribute values and component props are left alone: those
// carry the value, not its rendering.
function pythonText(markup) {
    let out = '';
    let i = 0;
    let inTag = false;
    let quote = null;

    while (i < markup.length) {
        const c = markup[i];

        if (inTag) {
            if (quote) {
                if (c === quote) quote = null;
            } else if (c === '"' || c === "'") {
                quote = c;
            } else if (c === '{') {
                // An attribute expression: keep the value as it is.
                const end = closingBrace(markup, i);
                if (end !== -1) {
                    out += markup.slice(i, end + 1);
                    i = end + 1;
                    continue;
                }
            } else if (c === '>') {
                inTag = false;
            }

            out += c;
            i++;
            continue;
        }

        if (c === '<') {
            inTag = true;
            out += c;
            i++;
            continue;
        }

        if (c === '{') {
            const end = closingBrace(markup, i);
            if (end === -1) {
                out += c;
                i++;
                continue;
            }

            const inner = markup.slice(i + 1, end);
            // Blocks and tags — {#if}, {:else}, {/each}, {@html} — are not values.
            out += '#/:@'.includes(inner.trimStart()[0])
                ? markup.slice(i, end + 1)
                : `{py.str(${inner.trim()})}`;

            i = end + 1;
            continue;
        }

        out += c;
        i++;
    }

    return out;
}

// `{#if items}` is a JavaScript condition, so an empty list — an object — reads
// as true where Python reads false. Same for an empty dict and for None. Route
// every condition through Python's own bool().
function pythonConditions(markup) {
    const opener = /\{(#if|:else\s+if)\s+/g;
    let out = '';
    let cut = 0;
    let match;

    while ((match = opener.exec(markup))) {
        const exprStart = match.index + match[0].length;
        const end = closingBrace(markup, match.index);
        if (end === -1) continue;

        out += markup.slice(cut, exprStart) + `py.truthy(${markup.slice(exprStart, end).trim()})`;
        cut = end;
        opener.lastIndex = end;
    }

    return out + markup.slice(cut);
}

const HAS_PYTHON_SCRIPT = /<script[^>]*\blang=["']python["']/;
const IMPORTS_STORE = /from\s+["'][^"']+\.py["']/;

// A component that only *consumes* a store has no Python script of its own, yet
// its markup still renders Python values and needs the same rewriting — so it
// needs `py` in scope too.
const needsRuntime = new Set();

// Python line numbers count from the start of the <script> body; the file counts
// from its first line. The gap is the number of lines before the opening tag.
const lineOffsets = new Map();

// The Svelte preprocessor: runs before Svelte parses the component, so the
// compiler only ever sees ordinary JavaScript with runes.
export function python() {
    return {
        name: 'svelthon',
        markup({ content, filename }) {
            const isPython = HAS_PYTHON_SCRIPT.test(content);
            if (!isPython && !IMPORTS_STORE.test(content)) return;

            if (!isPython) needsRuntime.add(filename);
            else lineOffsets.set(filename, content.slice(0, content.search(HAS_PYTHON_SCRIPT)).split('\n').length - 1);

            // Conditions first: pythonText then sees `{#if …}` and leaves it be.
            return { code: overMarkup(content, (markup) => pythonText(pythonConditions(markup))) };
        },
        script({ content, attributes, filename }) {
            if (attributes.lang !== 'python') {
                if (!needsRuntime.delete(filename)) return;
                return { code: `import { py } from 'svelthon/runtime';\n${content}` };
            }

            const name = nameFor(filename);
            const { script, module, map, stdlib, imports } = compile(
                content,
                name,
                relative(process.cwd(), filename || 'Component'),
                {
                    lineOffset: lineOffsets.get(filename) ?? 0,
                    // The whole file, so a debugger opens the .svelte itself.
                    sourceContent: filename ? readFileSync(filename, 'utf8') : content
                }
            );

            // `import counter_store` in a component resolves to a sibling .py.
            // The store module has to be evaluated before init() runs, so its
            // namespace is registered by the time Brython looks it up.
            const stores = imports
                .map((mod) => join(dirname(filename || '.'), `${mod}.py`))
                .filter((path) => existsSync(path));

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
    readdirSync('src')
        .filter((name) => name.endsWith('.test.js'))
        .reduce(
            (total, name) =>
                total + (readFileSync(`src/${name}`, 'utf8').match(/\btest\(/g) || []).length,
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
