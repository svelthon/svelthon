import { createRequire } from 'node:module';
import { relative, resolve, dirname } from 'node:path';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { compile, VIRTUAL_PREFIX, VFS_PREFIX } = require('./compile.cjs');

import { dtl } from './dtl.js';

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

// Template expressions compiled as Python.
//
// Each site becomes a hidden Python function appended to the module, and the
// markup calls it. The function reads the component's names through the
// namespace accessors, so Svelte discovers its dependencies exactly as it does
// for @derived — nothing to declare. The *kind* of site decides the wrapper:
// text renders with str(), a condition with bool(), which is why neither
// py.str() nor py.truthy() appears in the output any more.
//
// Only the two sites where a Python value is *read* are converted. Attribute
// values and event handlers stay JavaScript: they carry a value or a callback,
// not a rendering — the same boundary py.str() already drew.

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
        return `${name}(${args.join(', ')})`;
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

                    // A directive, a spread, or a bare shorthand: left as
                    // JavaScript. A named attribute carries a Python value.
                    out +=
                        attribute && !DIRECTIVE.test(attribute[1]) && !inner.trimStart().startsWith('...')
                            ? `{${call(inner, '')}}`
                            : markup.slice(index, end + 1);

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
const IMPORTS_STORE = /from\s+["'][^"']+\.py["']/;

// A component that only *consumes* a store has no Python script of its own, yet
// its markup still renders Python values and needs the same rewriting — so it
// needs `py` in scope too.
const needsRuntime = new Set();

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

// Django's loop counter, in Python because that is where the template reads it
// from: `forloop.counter` is attribute access, which a JavaScript object would
// not answer. Appended to a component's own source, and only when its markup
// names it — one object per row is not free.
const FORLOOP = `class __Forloop:
    def __init__(self, index, total):
        self.counter0 = index
        self.counter = index + 1
        self.revcounter = total - index
        self.revcounter0 = total - index - 1
        self.first = index == 0
        self.last = index == total - 1
        self.length = total


def __forloop(index, sequence):
    try:
        total = len(sequence)
    except TypeError:
        total = -1
    return __Forloop(index, total)`;

// The Svelte preprocessor: runs before Svelte parses the component, so the
// compiler only ever sees ordinary JavaScript with runes.
export function python() {
    return {
        name: 'svelthon',
        markup({ content, filename }) {
            const isPython = HAS_PYTHON_SCRIPT.test(content);
            if (!isPython && !IMPORTS_STORE.test(content)) return;

            // A component with no Python of its own — a store consumer — has
            // nowhere to put the hidden functions, so its markup keeps the
            // JavaScript path. The template language follows the script language.
            if (!isPython) {
                needsRuntime.add(filename);
                return { code: overMarkup(content, (markup) => pythonText(pythonConditions(markup))) };
            }

            lineOffsets.set(
                filename,
                content.slice(0, content.search(HAS_PYTHON_SCRIPT)).split('\n').length - 1
            );

            const collect = collector(filename);
            // Django syntax first, Svelte blocks after: the translation is
            // purely lexical, so everything downstream sees one language.
            return { code: overMarkup(content, (markup) => pythonExpressions(dtl(markup), collect)) };
        },
        script({ content, attributes, filename }) {
            if (attributes.lang !== 'python') {
                if (!needsRuntime.delete(filename)) return;
                return { code: `import { py } from 'svelthon/runtime';\n${content}` };
            }

            const name = nameFor(filename);
            const defs = templateFunctions.get(filename) || [];
            const helpers = defs.some((d) => d.includes('__forloop(')) ? [FORLOOP] : [];
            const appended = [...defs, ...helpers];
            const source = appended.length ? `${content}\n${appended.join('\n\n')}\n` : content;

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
