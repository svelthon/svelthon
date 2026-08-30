'use strict';

// Build-time half of Svelthon: run Brython's compiler under Node and split the
// result in two — a plain ES module holding the generated code, and a Svelte
// component script that wires it to runes.
//
// CommonJS because brython.js is a classic script that has to execute *after*
// the globals below are in place, which ES imports cannot order (they hoist).

globalThis.self ??= globalThis;           // touched by the bootstrap
globalThis.addEventListener ??= () => {}; // idem
globalThis.__BRYTHON__ ??= {};
globalThis.$B ??= globalThis.__BRYTHON__; // the codegen's eval() resolves $B globally

// The same snapshot `globals.js` takes, taken here too because this file loads
// Brython without it. Off a browser, brython.js installs `document`, `location`
// and three more, and `boot.js` removes whatever it added — by comparing against
// this set. Recorded too late, the stubs count as pre-existing and survive, and
// then every library that tests `typeof document` takes the browser path and
// dies on `window is not defined`.
globalThis.$B.$svelthonGlobalsBefore ??= new Set(Object.getOwnPropertyNames(globalThis));

require('../../vendor/brython.js');

const $B = globalThis.__BRYTHON__;
$B.brython({ ipy_id: [] });

const { INJECTED } = require('./injected.cjs');

// Name the generated module gives to the reactive namespace it receives.
const NS = '__py';

// Brython emits module state into a namespace object:
//     locals_Counter = $B.namespace('Counter')
//     locals_Counter.count = 0
// Nothing lives in a lexical binding, so there is a single call to intercept —
// which the runtime does at execution time. This pattern is only checked, never
// rewritten; if a future codegen stops emitting it, compilation fails loudly
// instead of producing a component with no reactivity at all.
const namespaceCall = (name) => `$B.namespace('${name}')`;

// The module id Brython derives from a filename: only '.' becomes '_'. It ends
// up as a *string* — the argument to $B.namespace and the frame name — so a '/'
// is harmless there. The identifier built beside it is a different matter, and
// the vendored build is patched so that one stays valid (see BRYTHON.md).
const namespaceFor = (filename) => filename.replace(/\./g, '_');

// A Brython exception carries neither `message` nor `stack`, so a Python syntax
// error would reach Vite as an empty object and be reported as nothing at all.
function pythonError(error, source, lineOffset) {
    // A JavaScript Error is not ours to describe: it already carries a message
    // and a stack, and wrapping it produced the useless
    // `JSObject: <Javascript object: [object Error]>` — which hid what actually
    // went wrong behind our own formatting.
    if (error instanceof Error) return error;

    let described = 'PythonError';
    let where = source;

    try {
        const name = $B.$getattr($B.get_class(error), '__name__');
        described = `${name}: ${$B.builtins.str.$factory(error)}`;
    } catch {
        /* not a Brython exception: keep the generic label */
    }

    try {
        const line = $B.$getattr(error, 'lineno');
        if (typeof line === 'number') where = `${source}:${line + lineOffset}`;
    } catch {
        /* no position on it */
    }

    return new SyntaxError(`svelthon — ${described} (${where})`);
}

// Brython scatters `$B.set_lineno(frame, N)` through the code it generates, so
// the generated JS carries the Python line it came from. That is enough for a
// line-level source map: the debugger then shows the .py or .svelte file rather
// than a thousand lines of generated JavaScript.
const VLQ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function vlq(value) {
    let rest = value < 0 ? (-value << 1) | 1 : value << 1;
    let encoded = '';

    do {
        let digit = rest & 31;
        rest >>>= 5;
        if (rest > 0) digit |= 32;
        encoded += VLQ_CHARS[digit];
    } while (rest > 0);

    return encoded;
}

function sourceMap(generated, source, content, lineOffset) {
    const marker = /\$B\.set_lineno\(frame, (\d+)\)/;
    const segments = [];
    let previous = 0;
    let current = null;

    for (const line of generated.split('\n')) {
        const found = line.match(marker);
        if (found) current = Number(found[1]) - 1 + lineOffset;

        if (current === null) {
            segments.push('');
            continue;
        }

        // One segment per line: column 0 of the generated line maps to column 0
        // of the Python line. Everything in a source map is delta-encoded.
        segments.push(vlq(0) + vlq(0) + vlq(current - previous) + vlq(0));
        previous = current;
    }

    return {
        version: 3,
        sources: [source],
        sourcesContent: [content],
        names: [],
        mappings: segments.join(';')
    };
}

// `__all__ = ["load"]` — Python's own way of saying what a module exports, and
// the closest thing it has to TypeScript's `export` keyword. Read from the AST,
// so it stays a plain assignment in the source.
function declaredExports(body) {
    for (const node of body) {
        if (!(node instanceof $B.ast.Assign)) continue;
        if (!node.targets.some((t) => t instanceof $B.ast.Name && t.id === '__all__')) continue;

        const items = node.value?.elts;
        if (!items) continue;

        return items
            .map((item) => (item instanceof $B.ast.Constant ? item.value : null))
            .filter((one) => typeof one === 'string');
    }

    return null;
}

// `__js__ = {"@sveltejs/kit": ["error", "redirect"]}` — the JavaScript a module
// needs. Python has no way to import from npm, and a plain `.py` has no
// `<script module>` to do it for them; this is its equivalent, written as an
// ordinary assignment and read from the AST like `__all__`.
function declaredJsImports(body) {
    for (const node of body) {
        if (!(node instanceof $B.ast.Assign)) continue;
        if (!node.targets.some((t) => t instanceof $B.ast.Name && t.id === '__js__')) continue;
        if (!node.value || !node.value.keys) continue;

        const modules = [];

        node.value.keys.forEach((key, index) => {
            const names = (node.value.values[index].elts || [])
                .map((one) => (one instanceof $B.ast.Constant ? one.value : null))
                .filter((one) => typeof one === 'string' && /^[A-Za-z_$][\w$]*$/.test(one));

            if (key instanceof $B.ast.Constant && names.length) {
                modules.push({ from: key.value, names });
            }
        });

        return modules;
    }

    return [];
}

// `importjs` — a component's JavaScript imports, written where its Python is.
//
// `__js__` covers a plain `.py`, and only the named form, which is all a module
// ever asks for: `error`, `redirect`, `query`, `browser`. A component asks for
// three more, and every one of them is a template concern — the default export,
// which is how a `.svelte` child is imported and by far the commonest (25 of the
// 65 imports measured across the three projects); a stylesheet, imported for its
// effect; and a namespace, which is what `<Dialog.Root>` needs. None of the three
// can occur in a module with no markup, which is why the dialect stops at the
// component and a `.py` keeps parsing as Python.
//
// A keyword rather than another declaration read from the AST. `__all__` is real
// Python and the compiler only reads it; `__js__` wears the same costume without
// the language behind it, and a dict literal invites being computed — which
// parses, raises nothing, and does not work. A keyword makes that unwriteable
// instead of merely wrong, the same way the walrus works in the markup: the
// syntax says what the thing is.
//
// The clause is JavaScript's own, since the keyword has already announced that
// much. There is nothing new to learn, and no ambiguity to invent between a
// default import and a named one.
const IMPORTJS = /^importjs\b/;
const IMPORTJS_ANYWHERE = /^[ \t]+importjs\b/;
const IMPORTJS_CLAUSE = /^importjs\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2\s*$/;
const IMPORTJS_EFFECT = /^importjs\s+(['"])([^'"]+)\1\s*$/;
const JS_NAME = /^[A-Za-z_$][\w$]*$/;

// The triple-quote state after `line`. Only a triple-quoted string survives a
// line break, so it is the only thing that can hide an `importjs` further down —
// the trap a regex over the whole source would walk straight into.
function endQuote(line, quote) {
    for (let i = 0; i < line.length; i++) {
        const three = line.slice(i, i + 3);

        if (quote) {
            if (three === quote) {
                quote = null;
                i += 2;
            } else if (line[i] === '\\') i++;
            continue;
        }

        if (three === '"""' || three === "'''") {
            quote = three;
            i += 2;
            continue;
        }

        if (line[i] === '#') return quote; // a comment runs to the end of the line

        if (line[i] === '"' || line[i] === "'") {
            const one = line[i];
            for (i++; i < line.length; i++) {
                if (line[i] === '\\') i++;
                else if (line[i] === one) break;
            }
        }
    }

    return quote;
}

// `x => expr` — the derived, written the way the state beside it is written.
//
// `count = 0` is state and `doubled => count * 2` is derived: one character
// apart, and that character is exactly "recomputed when something changes".
// Naming is not required for state — a bare assignment already says it — so it
// is not required here either, which is the whole argument for an operator
// rather than a word.
//
// It also reads as JavaScript's arrow, which is what a derived is: an
// expression that is re-evaluated rather than a value that was computed once.
//
// `=>` is a SyntaxError in Python, measured, so no valid source can contain one
// outside a string or a comment — the rewrite has no ambiguity to resolve. It
// becomes `x = derived(lambda: expr)` **on the same line**: `derived` is already
// injected as the identity, `surface()` reads the call off the AST, and the
// emission already calls whatever the namespace holds.
//
// Only the expression form. A derivation that needs statements keeps `@derived`,
// which is the counterpart of Svelte's own `$derived.by` — the same split their
// runes make, and the one Python already makes between `lambda` and `def`.
const ARROW = /^([A-Za-z_]\w*)\s*=>\s*(\S[\s\S]*)$/;

// `=> expr` — the same arrow with nothing to name, which is the effect.
//
// A derived and an effect are the one thing seen twice: both re-run when what
// they read has changed, and they differ only in whether anyone keeps the
// answer. Python already draws that line without a symbol — `x = f()` keeps,
// `f()` alone is done for its effect — so the arrow draws it the same way, and
// the absent name sits at the head of the line where the eye looks for one.
//
// Svelte 4 spelled both `$:` and Svelte 5 split them, because a `$:` statement
// did not show whether it computed or acted. Three of their four reasons were
// about static analysis and do not reach us — dependencies here come from the
// namespace accessors at run time. The fourth is that legibility, and putting
// the difference in the first column is the answer to it.
const EFFECT = /^=>\s*(\S[\s\S]*)$/;

// Brackets closed on the line, ignoring those inside a string.
function balanced(expr) {
    let depth = 0;
    let quote = null;

    for (let i = 0; i < expr.length; i++) {
        const c = expr[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'") quote = c;
        else if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
    }

    return depth === 0;
}
const ARROW_INDENTED = /^[ \t]+(?:[A-Za-z_]\w*\s*)?=>\s/;

function takeArrows(src, where, lineOffset, allowed) {
    const lines = src.split('\n');
    const out = [];
    let quote = null;
    let anonymous = 0;

    for (let n = 0; n < lines.length; n++) {
        const line = lines[n];
        const at = `${where}:${n + 1 + lineOffset}`;
        const kind = (named) => (named ? 'derived' : 'effect');

        if (quote === null && ARROW_INDENTED.test(line)) {
            throw new SyntaxError(
                `svelthon — a derived and an effect both belong at the top level of ` +
                    `the module, and \`=>\` is only read there (${at})`
            );
        }

        const found = quote === null ? line.match(ARROW) || line.match(EFFECT) : null;

        // A named match carries the name in group 1 and the expression in 2; an
        // anonymous one has the expression in 1, and its name is generated.
        const named = found && found.length > 2;
        const expression = found && (named ? found[2] : found[1]);

        // The expression has to finish on its line. A `{` or a `(` left open
        // would swallow the lines under it into a lambda, and Brython would
        // report a mismatched bracket several lines further down — which says
        // nothing about what to do. This says it.
        if (found && !balanced(expression)) {
            throw new SyntaxError(
                `svelthon — a ${kind(named)} written with \`=>\` must fit on one line; ` +
                    `use @${kind(named)} on a def for anything longer (${at})`
            );
        }

        if (found && !allowed) {
            throw new SyntaxError(
                `svelthon — \`=>\` belongs to a component; a .py module writes a ` +
                    `${kind(named)} with the @${kind(named)} decorator (${at})`
            );
        }

        // `inspect(…)` at the top level of a component, whose arguments become a
        // lambda so that they are read again on every change.
        const watched = quote === null && !found && allowed ? line.match(INSPECT) : null;

        // `value: str <=>`, with an optional fallback after the arrow.
        const both = quote === null && !found && !watched ? line.match(BINDABLE) : null;

        if (both && !allowed) {
            throw new SyntaxError(
                `svelthon — \`<=>\` marks a prop, and a prop belongs to a component; ` +
                    `a module has no parent to bind with (${at})`
            );
        }

        if (!found && !watched && !both) out.push(line);
        else if (watched) out.push(`__inspect_${anonymous++} = inspect(lambda: [${watched[1]}])`);
        else if (both) out.push(`${both[1]} = bindable(${both[2] || ''})`);
        else if (named) out.push(`${found[1]} = derived(lambda: ${expression})`);
        // The generated name is bound like any other effect's, so it stays out
        // of the way with the dunder prefix Python already reads as private.
        else out.push(`__effect_${anonymous++} = effect(lambda: ${expression})`);

        quote = endQuote(line, quote);
    }

    return out.join('\n');
}

function importJsClause(line, where) {
    const bare = line.match(IMPORTJS_EFFECT);
    if (bare) return { from: bare[2], kind: 'effect', entries: [] };

    const found = line.match(IMPORTJS_CLAUSE);
    if (!found) {
        throw new SyntaxError(
            `svelthon — importjs expects \`importjs <clause> from "module"\` or ` +
                `\`importjs "module"\`, on one line (${where})`
        );
    }

    const clause = found[1].trim();
    const from = found[3];

    const star = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (star) return { from, kind: 'namespace', entries: [{ name: null, local: star[1] }] };

    // `{a, b as c}` — the names between the braces, each optionally renamed.
    const namedEntries = (inner) => {
        const entries = inner
            .split(',')
            .map((one) => one.trim())
            .filter(Boolean)
            .map((one) => {
                const renamed = one.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
                if (renamed) return { name: renamed[1], local: renamed[2] };
                if (JS_NAME.test(one)) return { name: one, local: one };

                throw new SyntaxError(`svelthon — importjs: \`${one}\` is not a name (${where})`);
            });

        if (!entries.length) throw new SyntaxError(`svelthon — importjs: empty {} (${where})`);
        return entries;
    };

    const braced = clause.match(/^\{([\s\S]*)\}$/);
    if (braced) return { from, kind: 'named', entries: namedEntries(braced[1]) };

    // `Player, {stopAll}` — the default and some names, from the same module.
    // JavaScript's own clause allows it, and a component that imports both a
    // component and something from its `<script module>` needs exactly this.
    // The default comes first in `entries`, marked by a null `name`.
    const mixed = clause.match(/^([A-Za-z_$][\w$]*)\s*,\s*\{([\s\S]*)\}$/);
    if (mixed) {
        return {
            from,
            kind: 'mixed',
            entries: [{ name: null, local: mixed[1] }, ...namedEntries(mixed[2])]
        };
    }

    if (JS_NAME.test(clause)) return { from, kind: 'default', entries: [{ name: null, local: clause }] };

    throw new SyntaxError(`svelthon — importjs: \`${clause}\` is not an import clause (${where})`);
}

// Lift every `importjs` out of the source, leaving the line blank behind it.
//
// Blank rather than removed, and on the same line rather than rewritten into a
// call: the source map is line-level — `sourceMap()` emits column zero on both
// sides — so a line-preserving pass costs the debugger, the tracebacks and
// `$B.set_lineno` exactly nothing.
function takeImportJs(src, where, lineOffset, allowed) {
    const lines = src.split('\n');
    const imports = [];
    const kept = [];
    let quote = null;

    for (let n = 0; n < lines.length; n++) {
        const line = lines[n];
        const at = `${where}:${n + 1 + lineOffset}`;

        if (quote === null && IMPORTJS_ANYWHERE.test(line)) {
            // A JavaScript import is hoisted and static; there is no such thing
            // as one inside a branch, and silently hoisting it would be a lie.
            throw new SyntaxError(`svelthon — importjs must start the line, at the top level (${at})`);
        }

        if (quote === null && IMPORTJS.test(line)) {
            if (!allowed) {
                throw new SyntaxError(
                    `svelthon — importjs belongs to a component; a .py module declares its ` +
                        `JavaScript with __js__ = {"module": ["name"]} (${at})`
                );
            }

            imports.push(importJsClause(line.trim(), at));
            kept.push('');
            continue;
        }

        kept.push(line);
        quote = endQuote(line, quote);
    }

    return { source: kept.join('\n'), imports };
}

// One import statement, in whichever of the five shapes it was declared.
function jsImportLine(one) {
    const from = JSON.stringify(one.from);
    const list = (entries) =>
        entries.map((e) => (e.name === e.local ? e.local : `${e.name} as ${e.local}`)).join(', ');

    if (one.kind === 'effect') return `import ${from};`;
    if (one.kind === 'namespace') return `import * as ${one.entries[0].local} from ${from};`;
    if (one.kind === 'default') return `import ${one.entries[0].local} from ${from};`;

    if (one.kind === 'mixed') {
        const [first, ...rest] = one.entries;
        return `import ${first.local}, { ${list(rest)} } from ${from};`;
    }

    return `import { ${list(one.entries)} } from ${from};`;
}

// `src/counter_store.svelte.py` → `counter_store`, the name Python imports it by.
// The `.svelte` marker says the module is reactive; it is not part of its name,
// any more than it is for a `.svelte.ts`.
const pythonModuleName = (source) => source.split('/').pop().replace(/(\.svelte)?\.py$/, '');

// Python identifiers that JavaScript will not accept as bindings. They stay
// perfectly usable inside the component's Python; they simply are not published
// to the template.
const JS_RESERVED = new Set(`break case catch class const continue debugger default delete do else
enum export extends false function if implements in instanceof interface let new null package
private protected public return static super switch this throw true typeof var void while with
yield arguments eval`.split(/\s+/));

// The hidden functions the markup pass appends, one per expression it compiled.
// The name is chosen in `markup.js`; the two have to agree.
const EXPR_PREFIX = '__expr_';

// Inside a template expression, and only there, the dot finds a key as well as
// an attribute — `{pep.title}` reads a dict. The same text in the `<script>`
// stays plain Python and raises, which is the seam this marks.
const templateCall = (f, fn) => {
    const call = `${fn(f.name)}(...a.slice(0, ${f.arity}))`;
    return f.name.startsWith(EXPR_PREFIX) ? `inTemplate(() => ${call})` : call;
};

// Two of them are bound only where the name is actually read — `props_id`
// because its value must be computed at the top level rather than lazily, `host`
// because Svelte refuses `$host()` outright in a component that is not a custom
// element. Brython resolves a global by name, so the generated code carries the
// read wherever it happens — module level or inside a function alike — and a
// name that only appears inside a Python string does not.
const reads = (js, name) => js.includes(`'${name}'`);

const injectable = (one, declared, component, js) =>
    (component || !one.component) &&
    !declared.includes(one.name) &&
    (!one.whenRead || reads(js, one.name));

const injections = (declared, component, js) =>
    INJECTED.filter((one) => injectable(one, declared, component, js)).map(
        (one) => `bind(__proto, '${one.name}', ${one.value}, () => {});`
    );

// The lines those injections need in the component's preamble, before any of
// them is bound.
const injectedPreamble = (declared, component, js) =>
    INJECTED.filter((one) => one.emitted && injectable(one, declared, component, js)).map(
        (one) => one.emitted
    );

// Module-level names, read off the AST rather than the generated JS — the
// codegen mangles function names (`increment941818`) but the AST has the truth.
// `bindable()` and `derived()` are markers: the compiler reads them off the AST
// and the injected value is the identity, so nothing of them survives to run.
const isCallTo = (node, name) =>
    node.value instanceof $B.ast.Call &&
    node.value.func instanceof $B.ast.Name &&
    node.value.func.id === name;

const isBindable = (node) => isCallTo(node, 'bindable');

const hasDecorator = (node, name) =>
    (node.decorator_list || []).some((d) => d instanceof $B.ast.Name && d.id === name);

// `@effect.pre` — a dotted decorator, which is a different AST node: an
// `Attribute` over a `Name`, not a `Name`. The dotted form is PEP 318's original
// grammar, and the one Python uses to name a variant of something — `@property`
// and `@x.setter`. A standalone `@pre` would promise a composability that does
// not exist.
const hasDottedDecorator = (node, name, attribute) =>
    (node.decorator_list || []).some(
        (d) =>
            d instanceof $B.ast.Attribute &&
            d.attr === attribute &&
            d.value instanceof $B.ast.Name &&
            d.value.id === name
    );

function surface(body) {
    const props = [];
    const bindables = [];
    const state = [];
    const funcs = [];
    const deriveds = [];
    const effects = [];
    const inspects = [];
    const seen = new Set();

    const take = (name) => {
        if (seen.has(name) || JS_RESERVED.has(name)) return false;
        seen.add(name);
        return true;
    };

    for (const node of body) {
        if (node instanceof $B.ast.Assign) {
            for (const target of node.targets) {
                if (!(target instanceof $B.ast.Name) || !take(target.id)) continue;

                // `x => expr` arrives here as `x = derived(lambda: expr)`, and
                // `=> expr` as `__effect_0 = effect(lambda: expr)`. The emission
                // below needs no special case for either: it already writes
                // `$derived.by(() => __fn_x())` and `$effect(() => __fn_x())`,
                // and a lambda answers a call exactly as a `def` does.
                if (isCallTo(node, 'derived')) deriveds.push({ name: target.id, arity: 0 });
                else if (isCallTo(node, 'effect')) effects.push({ name: target.id, arity: 0 });
                else if (isCallTo(node, 'inspect')) inspects.push({ name: target.id, arity: 0 });
                else state.push(target.id);
            }
        } else if (node instanceof $B.ast.AnnAssign) {
            // An annotation is a declaration of interface, like a dataclass
            // field: `name: str` is a prop, `count: int = 0` a prop with a
            // default. A bare assignment stays internal state.
            if (node.target instanceof $B.ast.Name && take(node.target.id)) {
                (isBindable(node) ? bindables : props).push(node.target.id);
            }
        } else if (
            // `async def` is a different AST node, and missing it left async
            // handlers undefined — a click did nothing at all, silently.
            node instanceof $B.ast.FunctionDef ||
            node instanceof $B.ast.AsyncFunctionDef
        ) {
            if (!take(node.name)) continue;

            // @derived turns a function into a value: Python reads the name and
            // gets the result, exactly like a property. @effect re-runs it
            // whenever something it read has changed, and @effect.pre does the
            // same before the DOM is updated rather than after.
            const pre = hasDottedDecorator(node, 'effect', 'pre');
            const root = hasDottedDecorator(node, 'effect', 'root');
            const entry = {
                name: node.name,
                arity: (node.args && node.args.args || []).length,
                ...(pre ? { pre: true } : {}),
                ...(root ? { root: true } : {})
            };
            const bucket = hasDecorator(node, 'derived')
                ? deriveds
                : hasDecorator(node, 'effect') || pre || root
                  ? effects
                  : funcs;

            bucket.push(entry);
        }
    }

    return { props, bindables, state, funcs, deriveds, effects, inspects };
}

// The modules a `from x import y` names.
//
// Brython's own bookkeeping — `root.imports` — records `import x` and nothing
// else, so `from counter_store import count` was invisible to the prelude that
// resolves a sibling `.py`, and the component compiled cleanly then failed in
// the browser on a module it had never been given.
//
// Walked rather than read off the top level, because an import inside a function
// or a `try` is still an import.
//
// Asked twice, of the AST and of the text. The walk is the precise answer, but
// it leans on Brython's AST classes, and a build that reaches the browser
// through a bundler ends up with a second set of them, where the walk quietly
// matches nothing. The cost of asking twice is a name listed that was already
// going to be.
const FROM_IMPORT = /^[ \t]*from\s+([A-Za-z_][\w.]*)\s+import\s/gm;

function fromImportsInSource(src) {
    const found = new Set();
    let match;

    FROM_IMPORT.lastIndex = 0;
    while ((match = FROM_IMPORT.exec(src))) found.add(match[1]);

    return [...found];
}

function fromImports(ast) {
    const found = new Set();
    const BODIES = ['body', 'orelse', 'finalbody', 'handlers', 'cases', 'items'];

    const walk = (node) => {
        if (!node || typeof node !== 'object') return;

        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }

        // Recognised by shape, not by class. Brython builds its AST classes with
        // `eval`, and a bundled build ends up with a second set: `instanceof`
        // then answers false for a node that is plainly an ImportFrom, and a
        // sibling module silently stopped being resolved for any component
        // compiled in a browser. An ImportFrom is the only node carrying a
        // module name, an alias list and a level together — and a relative
        // import (`from . import x`) names no module.
        const importFrom =
            typeof node.module === 'string' && Array.isArray(node.names) && typeof node.level === 'number';

        if (importFrom) found.add(node.module);

        for (const key of BODIES) if (node[key]) walk(node[key]);
    };

    walk(ast.body);
    return [...found];
}

// Transitive closure of a component's imports over the build-time stdlib.
//
// What brython.js installs by itself, and which therefore needs no bundling:
// `builtins`, `browser`, `browser.aio`, `javascript`, `_sys`, `_warnings`,
// `_suggestions`, `_importlib`. Note that some of those — `browser` among them —
// *are* in the VFS as well, so they do not "drop out" for want of an entry, as
// this comment used to claim: they come through with a payload of nothing, which
// is why `from browser import aio` measures 0 KB. Measured, not assumed.
//
// The cost is not gradual. `math` is the one cheap module — 83 KB, no
// dependency of its own — and everything else drags the same 212-module closure:
// `json`, `fractions` and `dataclasses` each emit 2 869 KB. That is the whole
// reason the injected helpers exist: `batch` is there so that a template never
// has to reach for `itertools`.
function stdlibClosure(names) {
    const VFS = $B.VFS || {};
    const needed = {};
    const queue = [...names];

    while (queue.length) {
        const module = queue.shift();
        if (needed[module] || !VFS[module]) continue;

        needed[module] = VFS[module];
        queue.push(...(VFS[module][2] || []));

        // A submodule is useless without the packages above it.
        const parts = module.split('.');
        while (parts.length > 1) {
            parts.pop();
            queue.push(parts.join('.'));
        }
    }

    return needed;
}

function compile(
    src,
    name = 'Component',
    source = name,
    {
        store = false,
        plain = false,
        defs = [],
        jsNames = [],
        lineOffset = 0,
        sourceContent = null
    } = {}
) {
    // The namespace identifier is derived from `filename` alone — `module` and
    // `locals_id` are ignored by js_from_root. Upstream Brython maps only '.' to
    // '_', so a real path emitted `locals_src/Counter_svelte`, which is not
    // valid JavaScript; the vendored build is patched to neutralise every
    // character that cannot appear in an identifier (see BRYTHON.md). So the
    // real path can be passed, and Python's __file__ names the actual file —
    // which is what a traceback shows.
    //
    // The identifier Brython then derives is `nameFor()`'s own output, so the
    // namespace interception is unaffected.
    // A component has markup, so it has the dialect; a module is a module and
    // keeps parsing as Python. Lifted before py2js, since `importjs` is not
    // Python and Brython would rightly refuse it.
    const component = !store && !plain;

    // `src` is what the author wrote; `defs` are the hidden functions the markup
    // pass produced, one per template expression. They are joined here rather
    // than by the caller because the join carries an invariant, and an invariant
    // living in a comment at three call sites is one that will be got wrong.
    //
    // The invariant is the indentation. A `<script>` body sits inside markup and
    // every Svelte example indents it one level; in JavaScript that is
    // whitespace, in Python it is syntax, and the block raises
    // `IndentationError` — pointing, in Brython, at the line *after* the last
    // one, which tells the author nothing.
    //
    // `$B.unindent` is Brython's own, the one it already runs on every
    // `<script type="text/python">`, so the two tags behave alike and there is no
    // second copy of the rule to keep in agreement. It is private upstream, so
    // the vendored build exposes it in one token (see BRYTHON.md). Its rule is
    // `textwrap.dedent`'s with a conservative bail — one non-blank line already
    // at column zero and the source comes back untouched — and blank lines are
    // kept, so the line count never moves and the source map, the tracebacks and
    // `$B.set_lineno` are unaffected.
    //
    // It has to happen **before** the defs are appended: those are generated at
    // column zero and would trip that bail on every component. Holding that
    // order is why this lives here and not at the call sites.
    //
    // A `.py` gets neither half: a file is not an embedded block, so an indented
    // one is a mistake rather than a convenience, and a module has no template
    // to collect from.
    if (component) {
        const body = $B.unindent(src);
        src = defs.length ? `${body}\n${defs.join('\n\n')}\n` : body;
    }

    const lifted = takeImportJs(src, source, lineOffset, component);

    src = takeArrows(lifted.source, source, lineOffset, component);

    // Brython reads the source back out of this cache to quote the offending
    // line, and `compiler_error` does it without checking: an unregistered
    // filename turns every *compile* error — as opposed to a parse error, which
    // takes another path — into `Cannot read properties of undefined (reading
    // 'split')`. That covers `await` outside a coroutine, `return` and `yield`
    // outside a function, `break` and `continue` outside a loop: the mistakes a
    // beginner actually makes. Registering the source is all it takes to get
    // Brython's own message, which is CPython's.
    $B.file_cache[source] = src;

    let root;
    try {
        root = $B.py2js({ src, filename: source }, name, [name]);
    } catch (error) {
        throw pythonError(error, source, lineOffset);
    }
    let { props, bindables, state, funcs, deriveds, effects, inspects } = surface(root._ast.body);

    // Neither a store nor a plain module has a parent, so an annotation there
    // declares plain state — and $props() would be meaningless at module scope.
    if (store || plain) {
        state = [...props, ...bindables, ...state];
        props = [];
        bindables = [];

        // `$effect` needs a component to belong to, and neither has one. That is
        // exactly what `$effect.root` is for: it makes a scope of its own, which
        // is why `@effect.root` is the form a module writes. Anything else here
        // would be a function that looks reactive and is not, so it is refused
        // rather than quietly demoted — the same treatment `=>` gets in a `.py`.
        const orphan = effects.find((e) => !e.root);

        if (orphan) {
            throw new SyntaxError(
                `svelthon — \`@effect\` belongs to a component; ` +
                    `a ${plain ? '.py' : '.svelte.py'} module writes an effect with ` +
                    `\`@effect.root\`, whose name receives the destructor (${source})`
            );
        }

        // A plain module holds no signals at all, so an effect there would watch
        // nothing whatever it is spelled.
        if (plain && effects.length) {
            throw new SyntaxError(
                `svelthon — a plain .py module has no reactive state, so ` +
                    `\`@effect.root\` would watch nothing; move it to a .svelte.py (${source})`
            );
        }
    }

    // A plain module has no signals at all, so a @derived cannot be one either:
    // it becomes a function the accessor calls on every read. Same semantics —
    // read the name, get the result — minus the memoisation nothing observes.
    const plainDeriveds = plain ? deriveds : [];
    if (plain) deriveds = [];
    const js = root.to_js();

    // Brython derives the namespace identifier from the filename, neutralising
    // whatever cannot appear in a JavaScript identifier — so the name to hook is
    // a function of the file, not of `name`.
    const namespace = namespaceFor(source);

    if (!js.includes(namespaceCall(namespace))) {
        throw new Error(
            `svelthon: the code generated for ${source} never calls ${namespaceCall(namespace)} — ` +
                `Brython's codegen no longer exposes the module namespace where Svelthon hooks it`
        );
    }

    // Svelte reserves the '$' prefix for *every* scope inside a component, and
    // Brython's codegen opens with `var $B = __BRYTHON__`. So the generated
    // code lives in its own module, which Svelte never parses.
    const imported = [
        ...new Set([...Object.keys(root.imports), ...fromImports(root._ast), ...fromImportsInSource(src)])
    ];
    const module = [
        `import { withNamespace, pyError } from 'svelthon/runtime';`,
        ``,
        `export function init(${NS}) {`,
        `  try {`,
        `    return withNamespace('${namespace}', ${NS}, () => {`,
        js,
        `    });`,
        `  } catch (err) { throw pyError(err, ${JSON.stringify(source)}, ${lineOffset}); }`,
        `}`
    ].join('\n');

    // One signal per module-level name, published to Brython as an accessor.
    //
    // The namespace must NOT be a $state proxy: Svelte would deep-proxy every
    // Python value stored in it, and a proxied Brython object fails its own type
    // checks (`repr((1, 2))` raises "descriptor '__repr__' requires a 'tuple'
    // object but received a 'tuple'"). $state.raw keeps values opaque, so
    // reactivity tracks *rebinding a name* — which is what `count = …` and
    // `global count; count += 1` both do.
    //
    // Making `items.append(x)` reactive too was tried and abandoned: bumping a
    // revision signal that the bindings also read does invalidate them, but a
    // mutated list is still the *same object*, and both $derived and $state.raw
    // drop a write whose value is unchanged by ===. Propagating it would mean
    // handing the template a fresh copy on every render, at the cost of object
    // identity — too high a price for a rule that is easy to state instead.
    // The two declarations meet here, in one shape: `__js__` is the module's and
    // only ever names, `importjs` is the component's and covers the four forms.
    const jsImports = [
        ...declaredJsImports(root._ast.body).map((one) => ({
            from: one.from,
            kind: 'named',
            entries: one.names.map((n) => ({ name: n, local: n }))
        })),
        ...lifted.imports
    ];
    const jsImported = jsImports.flatMap((one) => one.entries.map((e) => e.local));

    const fn = (name) => `__fn_${name}`;
    const local = (name) => `__local_${name}`;
    // An imported JavaScript name, once it has been given a Python-aware
    // boundary — see `jsCall` in the runtime.
    const jsBound = (name) => `__js_${name}`;
    // Second signal per name: a mutation bumps it without touching the value,
    // so nothing is copied and the object keeps its identity.
    // What `$effect.root` hands back. Python reads the decorated name and gets
    // this, exactly as JavaScript reads `const destroy = $effect.root(…)` —
    // the name belongs to the destructor on both sides.
    const root = (name) => `__root_${name}`;
    const rev = (name) => `__rev_${name}`;
    const bump = (name) => `__bump_${name}`;
    const read = (name) => `__read_${name}`;

    // Lifecycle by convention, mapped onto a single $effect: its body runs once
    // after the DOM exists, its teardown when the component goes away. Both
    // names stay ordinary functions — nothing stops Python calling them too.
    const lifecycle = (hook) => !store && funcs.some((f) => f.name === hook);

    // A component free to define its own `publish` or `derived` keeps it.
    const declared = [
        ...props, ...bindables, ...state, ...funcs, ...deriveds, ...effects, ...inspects
    ].map((n) => n.name || n);

    // Context is per component subtree, where a store is per application — and
    // it is the only per-request-safe place to put state under server
    // rendering. Both must be called while an instance initialises, which is
    // exactly when the Python module body runs.

    // The plain module: a `.py` compiled to ordinary JavaScript. No runes, so
    // no need for the Svelte compiler and no need to be renamed `.svelte.js` —
    // which is what lets SvelteKit find a `+page.server.py` in its manifest. It
    // is the mirror of a plain `.ts` next to a `.svelte.ts`.
    // Functions by default — what a framework calls by name. A module that wants
    // to export values says so with `__all__`, exactly as it would to a Python
    // caller. SvelteKit is strict about it: a `+page.server.py` exporting
    // anything but load/actions/prerender/… is refused, and rightly so.
    const exported = (
        declaredExports(root._ast.body) ??
        [...funcs.map((f) => f.name), ...plainDeriveds.map((d) => d.name)]
    ).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n) && !JS_RESERVED.has(n));

    const isFunction = (name) =>
        funcs.some((f) => f.name === name) || plainDeriveds.some((d) => d.name === name);

    const plainScript = [
        `import { init } from ${JSON.stringify(virtualId(name))};`,
        `import { bind, __pybridge, pyError, scheduleAsync, plainData, pyArg, pyExport, jsCall, ticking, group, NONE, registerModule } from 'svelthon/runtime';`,
        ...jsImports.map(jsImportLine),
        ``,
        ...state.map((n) => `let ${n};`),
        ...[...funcs, ...plainDeriveds].map((f) => `let ${fn(f.name)};`),
        ``,
        `const __event = (fn) => pyEvent(fn, ${lineOffset});`,
        // What `(name := value)` in a handler compiles to. The write goes
        // through the namespace, so it goes through the accessor, so the signal
        // fires — which is the whole reason the walrus can mean this here.
        `const __assign = (name, value) => { ${NS}[name] = value; return value; };`,
        // What `bind:group` becomes: a directive whose value is Python.
        `const __group = group;`,
        `const __proto = {};`,
        ...state.map((n) => `bind(__proto, '${n}', () => ${n}, (v) => { ${n} = v; });`),
        ...funcs.map(
            (f) => `bind(__proto, '${f.name}', () => ${fn(f.name)}, (v) => { ${fn(f.name)} = v; });`
        ),
        ...plainDeriveds.map(
            (d) => `bind(__proto, '${d.name}', () => ${fn(d.name)}(), (v) => { ${fn(d.name)} = v; });`
        ),
        ...injections(declared, false),

        // The five a compiled template expression calls. Always injected, never
        // guarded: an author who shadowed one would silently take over every
        // interpolation in their own markup.
        `bind(__proto, '__truthy', () => __pybridge.truthy, () => {});`,
        `bind(__proto, '__text', () => __pybridge.str, () => {});`,
        `bind(__proto, '__seq', () => __pybridge.seq, () => {});`,
        `bind(__proto, '__spread', () => __pybridge.spread, () => {});`,
        `bind(__proto, '__bound', () => __pybridge.bound, () => {});`,
        `bind(__proto, '__assign', () => __assign, () => {});`,
        // Wrapped once, not on every read: a name Python compares by identity —
        // `handler is on_click` — has to answer the same object twice.
        ...[...new Set(jsImported)]
            .filter((n) => !declared.includes(n))
            .map((n) => `const ${jsBound(n)} = jsCall(${n});`),
        ...jsImported
            .filter((n) => !declared.includes(n))
            .map((n) => `bind(__proto, '${n}', () => ${jsBound(n)}, () => {});`),
        ``,
        `const ${NS} = Object.create(__proto);`,
        `${NS}.$proxy = true;`,
        ``,
        `registerModule(${JSON.stringify(pythonModuleName(source))}, ${NS});`,
        `init(${NS});`,
        ``,
        ...[...funcs, ...plainDeriveds].map(
            (f) =>
                `const ${f.name} = (...a) => { try { const r = scheduleAsync(${fn(f.name)}(...a.slice(0, ${f.arity ?? 0}).map(pyArg)), ${JSON.stringify(`${f.name}() — ${source}`)}, ${lineOffset});` +
                ` return r instanceof Promise ? r.then(plainData) : plainData(r); }` +
                ` catch (err) { throw pyError(err, ${JSON.stringify(`${f.name}() — ${source}`)}, ${lineOffset}); } };`
        ),
        ``,
        // SvelteKit reads `load`, `actions`, `GET`, `prerender` by name off the
        // module, so values are exported as well as functions — and a value goes
        // through the boundary too: `actions` is a dict of Python functions, each
        // of them called by the framework.
        //
        // No default export: SvelteKit refuses one on a route module, and a
        // Python module has no notion of a default anyway. Named exports are
        // the whole contract, and `__all__` is where it is written.
        ...exported
            .filter((n) => !isFunction(n))
            .map(
                (n) =>
                    `const __export_${n} = pyExport(${n}, ${JSON.stringify(`${n} — ${source}`)}, ${lineOffset});`
            ),
        ...(exported.length
            ? [
                  `export { ${exported
                      .map((n) => (isFunction(n) ? n : `__export_${n} as ${n}`))
                      .join(', ')} };`
              ]
            : [])
    ].join('\n');

    const componentScript = [
        `import { init } from ${JSON.stringify(virtualId(name))};`,
        // The bridge behind `__truthy` and the three beside it. Imported under a
        // name no one would type: it was called `py` back when a template's
        // expressions were JavaScript and an author wrote `py.str(items)` in the
        // markup — short on purpose. Now that only generated code touches it,
        // short is exactly wrong, and `py` is a name an author may want.
        `import { bind, __pybridge, track, follow, pyError, schedule, inTemplate, pyEvent, plainData, pyArg, jsCall, ticking, group, NONE${store ? ', registerModule' : ''} } from 'svelthon/runtime';`,
        ...jsImports.map(jsImportLine),
        `import { ${['getContext', 'setContext']
            .concat(lifecycle('on_mount') || lifecycle('on_destroy') ? ['untrack'] : [])
            .join(', ')} } from 'svelte';`,
        ``,
        ...(bindables.length
            ? [
                  `let { ${bindables.map((b) => `${b} = $bindable()`).join(', ')}, ...__props } =` +
                      ` $props();`,
                  ...bindables.flatMap((b) => [
                      `let ${rev(b)} = $state.raw(0);`,
                      `const ${bump(b)} = () => { ${rev(b)} += 1; };`,
                      `const ${read(b)} = () => { ${rev(b)}; };`
                  ]),
                  // The module body applies the annotation's default by writing
                  // to the name — and that write must not travel up to the
                  // parent. Only writes made after init() are real ones.
                  `let __initialising = true;`,
                  ``
              ]
            : props.length
              ? [`const __props = $props();`, ``]
              : []),
        // A prop's value comes from the parent when it was passed, and from the
        // annotation's default otherwise — the default being whatever the Python
        // body assigned during init(). Reading __props keeps it reactive, so a
        // parent update flows into Python's namespace on the next read.
        ...props.flatMap((n) => [
            `let ${local(n)} = $state.raw(undefined);`,
            `const ${n} = $derived(('${n}' in __props ? __props.${n} : ${local(n)}) ?? NONE);`
        ]),
        ...state.flatMap((n) => [
            `let ${n} = $state.raw(undefined);`,
            `let ${rev(n)} = $state.raw(0);`,
            `const ${bump(n)} = () => { ${rev(n)} += 1; };`,
            `const ${read(n)} = () => { ${rev(n)}; };`
        ]),
        ...funcs.map((f) => `let ${fn(f.name)} = $state.raw(undefined);`),
        ...inspects.map((i) => `let ${fn(i.name)} = $state.raw(undefined);`),
        ...effects.flatMap((e) =>
            e.root
                ? [`let ${fn(e.name)} = $state.raw(undefined);`, `let ${root(e.name)};`]
                : [`let ${fn(e.name)} = $state.raw(undefined);`]
        ),
        // A @derived name reads as its result — on both sides. The body runs
        // inside $derived.by, and every global it touches goes through a
        // namespace accessor, so Svelte discovers the dependencies by itself.
        ...deriveds.flatMap((d) => [
            `let ${fn(d.name)} = $state.raw(undefined);`,
            `const ${d.name} = $derived.by(() => ${fn(d.name)}());`
        ]),
        ``,
        `const __event = (fn) => pyEvent(fn, ${lineOffset});`,
        // What `(name := value)` in a handler compiles to. The write goes
        // through the namespace, so it goes through the accessor, so the signal
        // fires — which is the whole reason the walrus can mean this here.
        `const __assign = (name, value) => { ${NS}[name] = value; return value; };`,
        // What `bind:group` becomes: a directive whose value is Python.
        `const __group = group;`,
        `const __proto = {};`,
        // Python may write to a prop; the write lands in the local fallback and
        // is shadowed for as long as the parent supplies a value, which is
        // Svelte's own rule for non-bindable props.
        //
        // The accessors read the raw cell, never the tracked binding: Python must
        // not subscribe to Svelte's graph, only feed it.
        ...props.map(
            (n) =>
                `bind(__proto, '${n}', () => follow(('${n}' in __props ? __props.${n} : ${local(n)}) ?? NONE), (v) => { ${local(n)} = v; });`
        ),
        ...bindables.map(
            (b) =>
                `bind(__proto, '${b}', () => (${rev(b)}, follow(${b} ?? NONE)),` +
                ` (v) => { if (!__initialising || ${b} === undefined) ${b} = track(v, ${bump(b)}, ${read(b)}); });`
        ),
        // Reading the revision alongside the value is what registers the
        // dependency: an in-place mutation then invalidates every reader,
        // without the value ever changing identity.
        ...state.map(
            (n) =>
                `bind(__proto, '${n}', () => (${rev(n)}, ${n}), (v) => { ${n} = track(v, ${bump(n)}, ${read(n)}); });`
        ),
        ...funcs.map((f) => `bind(__proto, '${f.name}', () => ${fn(f.name)}, (v) => { ${fn(f.name)} = v; });`),
        ...inspects.map(
            (i) => `bind(__proto, '${i.name}', () => ${fn(i.name)}, (v) => { ${fn(i.name)} = v; });`
        ),
        // A root's name reads as its destructor; the setter still takes the
        // function, since that is what Brython writes when the `def` runs.
        ...effects.map((e) =>
            e.root
                ? `bind(__proto, '${e.name}', () => ${root(e.name)}, (v) => { ${fn(e.name)} = v; });`
                : `bind(__proto, '${e.name}', () => ${fn(e.name)}, (v) => { ${fn(e.name)} = v; });`
        ),
        // follow(): a @derived that hands back a container it was given is the one
        // place the revision cannot travel by itself — Svelte memoises the
        // derived on `===`, so the reader subscribes to the object instead.
        ...deriveds.map(
            (d) => `bind(__proto, '${d.name}', () => follow(${d.name}), (v) => { ${fn(d.name)} = v; });`
        ),
        ``,
        `const ${NS} = Object.create(__proto);`,
        // Reading a global goes through $B.resolve_global → resolve_in_namespace,
        // which demands an *own* property unless the namespace is flagged
        // $proxy — in which case it reads the property normally and therefore
        // walks the prototype chain, where our accessors live. It is the only
        // place in Brython that consults this flag.
        `${NS}.$proxy = true;`,
        // Every namespace Brython makes for itself carries the module's own
        // name, and `from x import y` reads it off the *importing* module to
        // work out what package it sits in. Ours had none, so the lookup asked
        // for a module called `undefined` — and said so, in a component where
        // `import x` on the line above had worked perfectly.
        `${NS}.__name__ = '${namespace}';`,

        ...injectedPreamble(declared, true, js),
        ...injections(declared, true, js),

        // Wrappers for compiled template expressions. Not Python's own bool()
        // and str(): a template may hold a foreign JavaScript value — a DOM node
        // from bind:this — on which Brython's classifier trips. These fall back.
        `bind(__proto, '__truthy', () => __pybridge.truthy, () => {});`,
        `bind(__proto, '__text', () => __pybridge.str, () => {});`,
        `bind(__proto, '__seq', () => __pybridge.seq, () => {});`,
        `bind(__proto, '__spread', () => __pybridge.spread, () => {});`,
        `bind(__proto, '__bound', () => __pybridge.bound, () => {});`,
        `bind(__proto, '__assign', () => __assign, () => {});`,
        // Wrapped once, not on every read: a name Python compares by identity
        // has to answer the same object twice.
        ...[...new Set([...jsImported, ...jsNames])]
            .filter((n) => !declared.includes(n))
            .map((n) => `const ${jsBound(n)} = jsCall(${n});`),
        ...jsImported
            .filter((n) => !declared.includes(n))
            .map((n) => `bind(__proto, '${n}', () => ${jsBound(n)}, () => {});`),
        // What the component imported in its `<script module>`, published so
        // Python can read it. A name Python declares itself wins.
        ...jsNames
            .filter((n) => !declared.includes(n))
            .map((n) => `bind(__proto, '${n}', () => ${jsBound(n)}, () => {});`),
        ``,
        `init(${NS});`,
        ...(bindables.length ? [`__initialising = false;`] : []),
        ``,
        // Event handlers are called with a DOM event Python never asked for.
        // Truncating to the declared arity is a placeholder for a real interop
        // policy (jsobj2pyobj on demand) — enough to make handlers work.
        // An uncaught Python exception arrives in JS without message or stack;
        // pyError fills them in, naming the function and the file it came from.
        ...funcs.map(
            (f) =>
                `const ${f.name} = (...a) => { try { return schedule(${templateCall(f, fn)}, ${JSON.stringify(`${f.name}() — ${source}`)}, ${lineOffset}); }` +
                ` catch (err) { throw pyError(err, ${JSON.stringify(`${f.name}() — ${source}`)}, ${lineOffset}); } };`
        ),
        ...(store
            ? [
                  ``,
                  `registerModule(${JSON.stringify(pythonModuleName(source))}, ${NS});`,
                  ``,
                  // Module-scope signals live once for the whole app. Exported
                  // through getters because Svelte forbids exporting a reassigned
                  // $state binding directly — and a getter is what keeps the read
                  // reactive at the call site.
                  `export const store = {`,
                  ...state.map((n) => `    get ${n}() { return (${rev(n)}, ${n}); },`),
                  ...state.map((n) => `    set ${n}(v) { ${n} = track(v, ${bump(n)}, ${read(n)}); },`),
                  ...deriveds.map((d) => `    get ${d.name}() { return follow(${d.name}); },`),
                  ...funcs.map((f) => `    ${f.name},`),
                  `};`,
                  ``,
                  `export default store;`,
                  // Named exports too: a `.py` is not only a store. SvelteKit
                  // looks for `load`, `actions`, `GET` — by name, on the module.
                  ...(funcs.length
                      ? [``, `export { ${funcs.map((f) => f.name).join(', ')} };`]
                      : [])
              ]
            : []),
        // Deliberately *not* untracked: discovering what the body read is the
        // whole point. A Python function that returns a callable hands back a
        // teardown, exactly as a Svelte effect does.
        // `$inspect` is given the call, not its result: Svelte wraps whatever it
        // receives in a thunk of its own and re-reads it on every change, so the
        // lambda is re-run and the namespace accessors do the tracking. A
        // production build drops the whole line — theirs, not ours.
        ...inspects.map((i) => `$inspect(...${fn(i.name)}());`),
        // A root owns its own scope: it is not cleaned up when the component is,
        // which is the point — the destructor is handed to Python under the
        // decorated name, and calling it is what ends the effect.
        ...effects.flatMap((e) => [
            ``,
            e.root
                ? `${root(e.name)} = $effect.root(() => { $effect(() => {`
                : `$effect${e.pre ? '.pre' : ''}(() => {`,
            `    let teardown;`,
            `    try { teardown = ${fn(e.name)}(); }` +
                ` catch (err) { throw pyError(err, ${JSON.stringify(`${e.name}() — ${source}`)}, ${lineOffset}); }`,
            `    if (typeof teardown === 'function') return () => { teardown(); };`,
            e.root ? `}); });` : `});`
        ]),
        ...(lifecycle('on_mount') || lifecycle('on_destroy')
            ? [
                  ``,
                  `$effect(() => {`,
                  // untrack, because a hook reads the component's names through
                  // the namespace accessors — and those reads are signal reads.
                  // `mounts += 1` inside on_mount would otherwise make the effect
                  // depend on state it also writes, and Svelte loops until it
                  // gives up with effect_update_depth_exceeded.
                  //
                  // Captured while the component is alive, too: reading a signal
                  // from a teardown, once destroyed, yields no function at all.
                  ...(lifecycle('on_destroy')
                      ? [`    const __teardown = untrack(() => ${fn('on_destroy')});`]
                      : []),
                  ...(lifecycle('on_mount') ? [`    untrack(() => on_mount());`] : []),
                  ...(lifecycle('on_destroy')
                      ? [
                            `    return () => { try { __teardown(); }` +
                                ` catch (err) { throw pyError(err, ${JSON.stringify(`on_destroy() — ${source}`)}, ${lineOffset}); } };`
                        ]
                      : []),
                  `});`
              ]
            : [])
    ].join('\n');

    const script = plain ? plainScript : componentScript;

    return {
        script,
        module,
        map: sourceMap(module, source, sourceContent ?? src, lineOffset),
        imports: imported
    };
}

const VIRTUAL_PREFIX = 'virtual:svelthon/';

const virtualId = (name) => VIRTUAL_PREFIX + name;

module.exports = { compile, VIRTUAL_PREFIX, virtualId };
