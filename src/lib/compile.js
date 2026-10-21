// Build-time half of Svelthon, `svelthon/compile`: run Brython's compiler under
// Node and split the result in two: a plain ES module holding the generated
// code, and a Svelte component script that wires it to runes.

// The engine first, which Bryntime loads started: static imports run in the
// order written, so everything below finds it started.
import 'bryntime';
import { INJECTED } from './injected.js';
import {
    compile as compileCommon,
    atomic,
    refuse,
    pythonName,
    jsNameBindings,
    NS,
    runtimeAliases,
    namespaceObject,
    NEXT_VALUE,
    bump,
    stateCell,
    stateBinding,
    walkScoped,
    symbolTable,
    scopeIn,
    isGlobalScope,
    moduleBinds,
    globalReads,
    children,
    declaredExports,
    exportChecks,
    unboundRefusals,
    moduleExports,
    liveExportLines,
    moduleLoad,
    PY_NAME,
    BODIES,
    EXPR_PREFIX,
    JS_RESERVED,
    COMPILER_PREFIX,
    refuseHostWords,
    refuseReserved,
    declaredJsImports,
    continuedLines,
    takeImportJs,
    jsImportLine,
    templateDots
} from 'bryc';

const $B = globalThis.__BRYTHON__;

// What a reactive module declares its `store` object under, the name it
// exports it by being one the module's own names may take.
const STORE_FACADE = '__store';

// `:=` in the markup writes a name of the component in a handler's `lambda`
// alone, which the markup pass has rewritten by then (`walrus`). Anywhere else
// Python binds the name in the function the expression compiles to, or in a
// `lambda` inside it, and the write dies with the call: `{(n := 1)}` showed 1
// and left the component's `n` as it was. A name of the module so written is
// refused at the markup that wrote it. One of the block's own, a parameter of
// the function, binds as CPython binds it, a `lambda`'s parameter is its own,
// and a temporary handed to a call is one by its form, as in a handler.
function refuseTemplateWalrus(ast, table, source, ranges) {
    const names = moduleBinds(table);

    for (const def of ast.body) {
        if (!(def instanceof $B.ast.FunctionDef) || !def.name.startsWith(EXPR_PREFIX) || def.name.startsWith(`${EXPR_PREFIX}set_`)) continue;

        const walked = new WeakSet();
        const visit = (node, own) => {
            if (node === null || typeof node !== 'object' || walked.has(node)) return;
            walked.add(node);
            if (Array.isArray(node)) return node.forEach((one) => visit(one, own));

            if (node instanceof $B.ast.Lambda) {
                const params = [...node.args.posonlyargs, ...node.args.args, ...node.args.kwonlyargs, node.args.vararg, node.args.kwarg];

                visit(node.args.defaults, own);
                visit(node.args.kw_defaults, own);
                visit(node.body, new Set([...own, ...params.filter(Boolean).map((one) => one.arg)]));
                return;
            }

            // The wrapper the markup pass puts around the expression,
            // `__text(…)`, is the compiler's call and not the author's: its
            // argument is the expression itself.
            const authors = node instanceof $B.ast.Call && !(node.func instanceof $B.ast.Name && COMPILER_PREFIX.test(node.func.id));

            if (authors) {
                visit(node.func, own);
                for (const one of node.args) visit(one instanceof $B.ast.NamedExpr ? one.value : one, own);
                visit(node.keywords, own);
                return;
            }

            if (node instanceof $B.ast.NamedExpr && names.has(node.target.id) && !own.has(node.target.id)) {
                const range = ranges.find(([from, to]) => node.lineno >= from && node.lineno <= to);
                const [line, column] = range === undefined ? [undefined, undefined] : [range[2], range[3]];
                const at = line === undefined ? '' : ` (${source}:${line}:${column + 1})`;
                const name = node.target.id;

                throw refuse(
                    `svelthon — \`${name} := …\` in the markup writes the component's \`${name}\` only in a ` +
                        `handler's \`lambda\`, \`onclick={lambda: (${name} := …)}\`, run on an event${at}. ` +
                        `Here the expression runs while the page renders, which must not write state, and ` +
                        `Python would bind a \`${name}\` of its own that dies with it.`,
                    source,
                    line,
                    column
                );
            }

            // A node's `$parent` leads back up to the module, the script's own
            // walruses among it.
            for (const key of Object.keys(node)) {
                if (!key.startsWith('$') && (key !== 'target' || !(node instanceof $B.ast.NamedExpr))) visit(node[key], own);
            }
        };

        visit(def.body, new Set(def.args.args.map((one) => one.arg)));
    }
}


// `x => expr`, the derived, written the way the state beside it is written.
//
// `count = 0` is state and `doubled => count * 2` is derived: one character
// apart, and that character is exactly "recomputed when something changes".
// Naming is not required for state, a bare assignment already says it, so it
// is not required here either, which is the whole argument for an operator
// rather than a word.
//
// It also reads as JavaScript's arrow, which is what a derived is: an
// expression that is re-evaluated rather than a value that was computed once.
//
// `=>` is a SyntaxError in Python, so no valid source can contain one
// outside a string or a comment, so the rewrite has no ambiguity to resolve. It
// becomes `x = derived(lambda: expr)` **on the same line**: `derived` is already
// injected as the identity, `surface()` reads the call off the AST, and the
// emission already calls whatever the namespace holds.
//
// Only the expression form. A derivation that needs statements keeps `@derived`,
// which is the counterpart of Svelte's own `$derived.by`: the same split their
// runes make, and the one Python already makes between `lambda` and `def`.
// Where a trailing comment starts, or -1, by `atomic`'s reading: a `#` inside a
// string is not a comment.
//
// The dialect's signs each take the rest of the line, `(\S[\s\S]*)$`, and the
// rewrite wraps what they took in parentheses, so a trailing comment is cut
// first, or its `#` would comment out the closing one. Everything Python's own
// syntax carries accepts a trailing comment, and so does every sign of ours.
function commentAt(line) {
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '#') return i;

        // A string, which runs to the end of the line when it is not closed on it.
        const skip = atomic(line, i);
        if (skip > 0) i += skip - 1;
    }

    return -1;
}

// A name, spelled the way Python spells one. `\w` is ASCII in JavaScript, so
// `[A-Za-z_]\w*` made `année` a name to the script's `=` and not to its `=>` or
// its `<=>`, which refused it with Brython's `invalid syntax`. Marks are in the
// class because a name in Vietnamese or Devanagari carries them.
const ARROW_DERIVED = /^([\p{XID_Start}_]\p{XID_Continue}*)\s*=>\s*(\S[\s\S]*)$/u;

// `=> expr`, the same arrow with nothing to name, which is the effect.
//
// A derived and an effect are the one thing seen twice: both re-run when what
// they read has changed, and they differ only in whether anyone keeps the
// answer. Python already draws that line without a symbol: `x = f()` keeps,
// `f()` alone is done for its effect, so the arrow draws it the same way, and
// the absent name sits at the head of the line where the eye looks for one.
//
// Svelte 4 spelled both `$:` and Svelte 5 split them, because a `$:` statement
// did not show whether it computed or acted. Three of their four reasons were
// about static analysis and do not reach us: dependencies here come from the
// namespace accessors at run time. The fourth is that legibility, and putting
// the difference in the first column is the answer to it.
const ARROW_EFFECT = /^=>\s*(\S[\s\S]*)$/;

// `inspect(count, message)`: a console.log that reruns on its own, and that the
// production build drops entirely.
//
// The values have to be *read again* on every change, so they cannot be handed
// over already read. Svelte solves that for itself, compiling `$inspect(x)`
// into `$.inspect(() => [x], …)`, and the same trick works here one level down:
// the arguments go into a lambda, and calling it re-reads them through the
// namespace accessors, which is what makes Svelte follow them.
//
// Their `$inspect(x).with(fn)` chains, which Python cannot spell: `with` is a
// keyword. `inspect_with(fn, *values)` is that form with the callable in front,
// where Python puts it whenever position stops being enough. The two are read by
// the same rule and told apart by the name alone.
const INSPECT = /^inspect(_with)?\s*\((\s*\S[\s\S]*)\)\s*$/;
const INSPECT_OPENED = /^inspect(_with)?\s*\(/;
const newlines = (text) => text.split('\n').length - 1;

// The first argument of a call's text and the rest, where Python's parser ends
// the first argument: a comma does not say it, since `lambda kind, *values: …`
// holds one between its parameters and a string or an f-string's field may
// hold one too. A text that does not parse is handed back whole, and the
// module's own parse then says what is wrong with it, at its line.
function firstArgument(text) {
    const call = `f(${text})`;
    let first;

    try {
        first = $B._PyPegen.run_parser(new $B.Parser(call, '<arguments>', 'file')).body[0].value.args[0];
    } catch {
        return [text.trim(), ''];
    }

    // No positional argument to take first, `inspect_with(**options)` or a call
    // with nothing in it, or one that is a whole sequence, `*values`.
    if (first === undefined || first instanceof $B.ast.Starred) return null;

    // Where the first argument ends, by its line and its column, since a call
    // laid out by a formatter puts it on a line of its own; past `f(`.
    const starts = [0];
    for (let i = 0; i < call.length; i++) if (call[i] === '\n') starts.push(i + 1);
    const end = starts[first.end_lineno - 1] + first.end_col_offset - 2;

    return [text.slice(0, end).trim(), text.slice(end).replace(/^\s*,/, '').trim()];
}

// `value: str <=>`, a prop that also travels back up, and the fourth of the
// dialect's bindings. They are one system, built around the same sign, and what
// surrounds it says which:
//
//     count = 0                 a name to a value, once
//     doubled => count * 2      a name to an expression, re-run
//     (open := not open)        a name from *inside* an expression
//     value: str <=>            a name that travels both ways
//
// The nameless arrow, `=> expr`, is not one of them: with nothing to bind, it is
// an effect.
//
// The double arrow is the only one of the four that had to be written as a word,
// and the two readings of `<=>` agree for once: two directions, and logic's
// equivalence: the parent and the child hold the same value.
//
// It is sugar over `bindable()`, which stays: a searchable name for the reader
// who arrives from Svelte's `$bindable`, exactly as `derived(lambda: …)` stays
// under `=>`.
const BINDABLE = /^([\p{XID_Start}_]\p{XID_Continue}*\s*:\s*[^=<>]+?)\s*<=>\s*(\S[\s\S]*)?$/u;

// Brackets closed on the line, ignoring those inside a string.
const balanced = (expr) => opened(expr) === 0;

// Brackets the line leaves open, ignoring those inside a string: what makes the
// next line a continuation rather than a statement. `lowest` is the depth the
// text went down to: below zero, it closed a bracket it did not open, as the
// arguments of `inspect(count); print(count)` read to the last `)` do.
function opened(expr, lowest = { depth: 0 }) {
    let depth = 0;

    for (let i = 0; i < expr.length; i++) {
        const skip = atomic(expr, i);

        if (skip > 0) {
            i += skip - 1;
            continue;
        }

        const c = expr[i];

        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') lowest.depth = Math.min(lowest.depth, --depth);
    }

    return depth;
}

// The arguments of one call, and not the tail of one and the head of another.
const enclosed = (expr) => {
    const lowest = { depth: 0 };

    return opened(expr, lowest) === 0 && lowest.depth === 0;
};
// The name the first `:=` of an expression binds in the expression's own scope,
// or null, read off its AST: one in an f-string's field counts, one in the body
// of a lambda of its own binds there and does not, and one in that lambda's
// defaults counts, since a default is evaluated where the lambda is written. A
// text the parser refuses answers null, and the compile that follows reports it.
function walrusIn(expr) {
    let tree;
    try {
        tree = $B._PyPegen.run_parser(new $B.Parser(`(${expr})\n`, '<arrow>', 'file'));
    } catch {
        return null;
    }

    const find = (node) => {
        if (node instanceof $B.ast.NamedExpr) return node.target.id;
        const inside = node instanceof $B.ast.Lambda
            ? [...node.args.defaults, ...node.args.kw_defaults].filter(Boolean)
            : children(node);
        for (const one of inside) {
            const found = find(one);
            if (found !== null) return found;
        }
        return null;
    };

    return find(tree);
}

const ARROW_INDENTED = /^[ \t]+(?:[\p{XID_Start}_]\p{XID_Continue}*\s*)?=>\s/u;

// `theirs` names what the author imported with `importjs`.
function takeArrows(src, where, lineOffset, allowed, theirs = new Set()) {
    const lines = src.split('\n');
    const continued = continuedLines(src);
    const out = [];
    let anonymous = 0;
    // Brackets left open, and a backslash at the end of the line before: the
    // line is then the continuation of a statement, whatever its column, and no
    // sign is read on it.
    let depth = 0;
    let joined = false;

    for (let n = 0; n < lines.length; n++) {
        const line = lines[n];
        const lineno = n + 1 + lineOffset;
        const at = `${where}:${lineno}`;
        const kind = (named) => (named ? 'derived' : 'effect');
        const code = !continued[n];

        if (code && ARROW_INDENTED.test(line)) {
            throw refuse(
                `svelthon — a derived and an effect both belong at the top level of ` +
                    `the module, and \`=>\` is only read there (${at})`,
                where,
                lineno
            );
        }

        // Read without its trailing comment, so a sign may carry one the way
        // every other line of Python does. See `commentAt`.
        const cut = code ? commentAt(line) : -1;
        const text = cut === -1 ? line : line.slice(0, cut).trimEnd();
        const statement = code && depth === 0 && !joined;

        if (code) {
            depth = Math.max(0, depth + opened(text));
            joined = text.endsWith('\\');
        }

        const found = statement ? text.match(ARROW_DERIVED) || text.match(ARROW_EFFECT) : null;

        // A named match carries the name in group 1 and the expression in 2; an
        // anonymous one has the expression in 1, and its name is generated.
        const named = found && found.length > 2;
        const expression = found && (named ? found[2] : found[1]);

        // The expression has to finish on its line. A `{` or a `(` left open
        // would swallow the lines under it into a lambda, and Brython would
        // report a mismatched bracket several lines further down, which says
        // nothing about what to do. This says it, for a backslash at the end of
        // the line as well.
        if (found && (!balanced(expression) || joined)) {
            throw refuse(
                `svelthon — a ${kind(named)} written with \`=>\` must fit on one line; ` +
                    `use @${kind(named)} on a def for anything longer (${at})`,
                where,
                lineno
            );
        }

        // The right-hand side becomes the body of a lambda, and a name `:=`
        // binds there is the lambda's: in `doubled => (half := count) * 2`,
        // `half` would stay unbound in the module, where `=` binds it.
        const walrus = found ? walrusIn(expression) : null;

        if (walrus !== null) {
            throw refuse(
                `svelthon — \`${walrus} :=\` inside \`=>\` would bind \`${walrus}\` in the ` +
                    `lambda the ${kind(named)} becomes, not in the module; assign it on a ` +
                    `line of its own (${at})`,
                where,
                lineno
            );
        }

        if (found && !allowed) {
            throw refuse(
                `svelthon — \`=>\` belongs to a component; a .py module writes a ` +
                    `${kind(named)} with the @${kind(named)} decorator (${at})`,
                where,
                lineno
            );
        }

        // `inspect(…)` at the top level of a component, whose arguments become a
        // lambda so that they are read again on every change. A call to an
        // `inspect` the author imported from JavaScript is theirs, as written.
        //
        // One left open on its line, as a formatter lays out a long call, is
        // the lines up to the one that closes it, read as one statement and
        // written back over as many lines, so every line keeps its number.
        let call = text;
        let last = n;

        if (statement && !found && allowed && INSPECT_OPENED.test(text) && depth > 0) {
            const gathered = [text];

            while (depth > 0 && last + 1 < lines.length) {
                last += 1;
                const inCode = !continued[last];
                const stop = inCode ? commentAt(lines[last]) : -1;
                const kept = stop === -1 ? lines[last] : lines[last].slice(0, stop).trimEnd();

                if (inCode) {
                    depth = Math.max(0, depth + opened(kept));
                    joined = kept.endsWith('\\');
                }
                gathered.push(kept);
            }

            call = gathered.join('\n');
        }

        const matched = statement && !found && allowed ? call.match(INSPECT) : null;
        const inspected = matched && enclosed(matched[2]) ? matched : null;
        const watched = inspected && !theirs.has(inspected[1] ? 'inspect_with' : 'inspect') ? inspected : null;

        if (last > n && !watched) {
            out.push(...lines.slice(n, last + 1));
            n = last;
            continue;
        }

        n = last;

        // `value: str <=>`, with an optional fallback after the arrow.
        const both = statement && !found && !watched ? text.match(BINDABLE) : null;

        if (both && !allowed) {
            throw refuse(
                `svelthon — \`<=>\` marks a prop, and a prop belongs to a component; ` +
                    `a module has no parent to bind with (${at})`,
                where,
                lineno
            );
        }

        // Each sign is written with a marker, and one the author imported from
        // JavaScript under that name would be called in its place.
        const marker = found ? kind(named) : both ? 'bindable' : null;

        if (theirs.has(marker)) {
            throw refuse(
                `svelthon — \`${both ? '<=>' : named ? 'name =>' : '=>'}\` is written with ` +
                    `\`${marker}\`, and \`${marker}\` here is the one imported from JavaScript; ` +
                    `import it under another name, \`importjs {${marker} as …}\` (${at})`,
                where,
                lineno
            );
        }

        // A call over several lines is written back over as many: what the
        // rewrite trims off its arguments is given back as blank lines below.
        const lined = (rewritten) => rewritten + '\n'.repeat(Math.max(0, newlines(call) - newlines(rewritten)));

        if (!found && !watched && !both) out.push(line);
        else if (watched && watched[1]) {
            // `inspect_with(logger, *values)`: two roles Svelte evaluates apart,
            // the values when it inspects and the logger when it logs. So two
            // lambdas, handed over as a pair that costs nothing to build.
            const parts = firstArgument(watched[2]);

            if (parts === null) {
                throw refuse(
                    `svelthon — \`inspect_with\` takes the function that logs first, then the values it ` +
                        `watches: \`inspect_with(print, count)\` (${at})`,
                    where,
                    lineno
                );
            }

            const [logger, values] = parts;
            out.push(
                lined(`__inspect_${anonymous++} = inspect_with(lambda: (lambda: [${values}], lambda: ${logger}))`)
            );
        } else if (watched)
            out.push(lined(`__inspect_${anonymous++} = inspect(lambda: [${watched[2]}])`));
        // The right-hand side in parentheses, as the `=` it stands for reads it:
        // `pair => a, b` is the tuple `(a, b)`, and `=> f(a), g(a)` makes both
        // calls in the effect, rather than a second argument of the marker.
        else if (both) out.push(`${both[1]} = bindable(${both[2] ? `(${both[2]})` : ''})`);
        else if (named) out.push(`${found[1]} = derived(lambda: (${expression}))`);
        // The generated name is bound like any other effect's, so it stays out
        // of the way with the dunder prefix Python already reads as private.
        else out.push(`__effect_${anonymous++} = effect(lambda: (${expression}))`);
    }

    return out.join('\n');
}

// The components a component's Python imports by default from a `.svelte`
// file, `importjs Child from "./Child.svelte"`, read by the same rule as the
// compiler reads the line: what each local name is, and where it comes from.
// Nothing for a script the compiler would refuse, which it then does itself.
function componentImports(src, where) {
    try {
        return takeImportJs(HOST, src, where, 0, true)
            .imports.filter((one) => one.from.endsWith('.svelte'))
            .flatMap((one) =>
                one.entries
                    .filter((entry) => entry.name === null || entry.name === 'default')
                    .map((entry) => ({ local: entry.local, from: one.from }))
            );
    } catch {
        return [];
    }
}

// `src/counter_store.svelte.py` → `counter_store`, the name Python imports it by.
// The `.svelte` marker says the module is reactive; it is not part of its name,
// any more than it is for a `.svelte.ts`.
const pythonModuleName = (source) => source.split('/').pop().replace(/(\.svelte)?\.py$/, '');

// Every name the runtime lends the generated code arrives under a `__` spelling.
//
// A component's own declarations sit in the same scope, and `group`, `init`,
// `track`, `follow` or `schedule` are words a Python author writes. Neither
// guard covers them: `JS_RESERVED` refuses what JavaScript will not take, and
// the locked list Svelthon's own vocabulary. The runtime's names are a third
// category, and the answer is a prefix, as `helpers as __helpers` has.
//
// The list is written out rather than derived, so the spelling exists as text in
// this file: `tests/generated-names.test.js` checks that the markup pass and the
// compiler agree on every `__name`, by reading both files, and a name computed
// at run time is invisible to it. Three of them carry the spelling the markup
// pass emits, which is why this is a map and not a prefix.
const RUNTIME = {
    bind: '__bind',
    track: '__track',
    changesNothing: '__changesNothing',
    follow: '__follow',
    followOwn: '__followOwn',
    SHAPING: '__SHAPING',
    pyError: '__pyError',
    pyEvent: '__pyEvent',
    pyAttach: '__pyAttach',
    plainData: '__plainData',
    pyArg: '__pyArg',
    pyData: '__pyData',
    pyCall: '__pyCall',
    pyTeardown: '__pyTeardown',
    laterRoot: '__laterRoot',
    pyComponent: '__pyComponent',
    pyExpression: '__pyExpression',
    invoke: '__invoke',
    pyExport: '__pyExport',
    liveExport: '__liveExport',
    readOnlyImport: '__readOnlyImport',
    templateFrom: '__templateFrom',
    fileLines: '__fileLines',
    jsCall: '__jsCall',
    ticking: '__ticking',
    pyBind: '__pyBind',
    plainScalar: '__plainScalar',
    storeMember: '__storeMember',
    directiveAction: '__directiveAction',
    directiveTransition: '__directiveTransition',
    directiveAnimate: '__directiveAnimate',
    NONE: '__NONE',
    helpers: '__helpers',
    unsubscribe: '__unsubscribe',
    unproxied: '__unproxied',
    handOver: '__handOver',
    pythonModule: '__pythonModule',
    withNamespace: '__withNamespace',
    __pybridge: '__pybridge',
    jsGlobal: '__global',
    group: '__group',
    readAttr: '__getattr',
    restOf: '__rest',
    unpackStarred: '__unpack',
    writeAttr: '__setattr',
    writeItem: '__setitem'
};

// What stands in for the standard modules an author reaches for first: a
// builtin, the helpers the runtime injects, and `js`.
const MODULE_INSTEAD = {
    json: '`from_json(text)` reads JSON and `tojson(value)` writes it',
    math: '`abs`, `round`, `min`, `max` and `pow` are builtins, and `js.Math` holds the rest',
    random: '`js.Math.random()` draws a number',
    datetime: '`date` and `fromnow` show a date, and `js.Date` reads the clock',
    time: '`js.Date.now()` reads the clock'
};

// What Bryc is told of the framework it compiles for, by the interface its
// door writes out: the name its refusals are said under, the tool the author
// ran; the module the generated code imports its runtime from; the names it
// reaches that runtime by; the words it reserves, the locked ones of its
// injection, a component's alone free in a plain `.py`, and what of its
// injection may still be shadowed; what stands in for a standard module; the
// name of the plugin's option a module is also found on, `path`; how a name
// becomes a state, Svelte's state with a revision beside it, which a change in
// place moves while the value keeps its identity, and which a read reads with
// the value; Svelthon's own signs made Python (`takeArrows`); and Svelte's
// runes, whose names no binding of the component may take: Svelte reads
// `$state` as a store once `state` is bound, so a JavaScript import of one is
// held under another variable (Bryc's), and a `def`'s wrapper too
// (`wrapperName`).
const HOST = {
    name: 'svelthon',
    bridge: 'svelthon/bridge',
    runtime: RUNTIME,
    reserved: {
        words: INJECTED.filter((one) => one.locked).map((one) => ({ name: one.name, component: one.component === true })),
        said: 'The helpers, `date`, `slugify`, `tojson` and the rest, may still be shadowed; the decorators may not.'
    },
    instead: MODULE_INSTEAD,
    pathOption: 'path',
    state: {
        cell: (name, cell, bumped) => [
            `let ${cell} = $state.raw(undefined);`,
            `let ${rev(name)} = $state.raw(0);`,
            `const ${bumped} = () => { ${rev(name)} += 1; };`
        ],
        value: (cell) => cell,
        read: (name, cell) => `(${rev(name)}, ${cell})`,
        write: (cell, value) => `${cell} = ${value}`
    },
    rewrite: (text, { source, lineOffset, component, bound }) => takeArrows(text, source, lineOffset, component, bound),
    runes: ['state', 'derived', 'effect', 'props', 'bindable', 'inspect', 'host']
};

// How many positional arguments a caller may hand a Python function, read off
// its signature so the wrapper can drop the rest.
//
// Not `args.args.length` alone, which is only the middle third of a positional
// signature: `def positional(x, /, y)` puts `x` in `posonlyargs`, and
// `def variadic(*values)` has no `args` at all.
//
// `Infinity` for a `*args`, because there is no number to truncate to: it is a
// JavaScript literal and `slice(0, Infinity)` is the whole list. Truncation
// exists to keep a DOM event object out of a handler that never asked for one,
// and a function that asks for everything has asked for that too.
const arityOf = (args) =>
    args && args.vararg
        ? Infinity
        : ((args && args.posonlyargs) || []).length + ((args && args.args) || []).length;

// Which wrapper a component's function gets: the runtime holds both, and this
// says which one. An expression function the markup compiled takes its arguments
// already Python; everything else here is called by Svelte, with Svelte's values.
const componentWrapper = (f) => (f.name.startsWith(EXPR_PREFIX) ? '__pyExpression' : '__pyComponent');

// The template functions whose value Python reads again, named so by the markup
// pass: a declaration of the markup and a `{@render}` argument (`py_`), and a
// default inside a pattern (`lazy_`). Their value is handed back as it is.
const KEPT_PYTHON = /^__expr_(?:py|lazy)_/;
// An expression whose value a binding compares, named by how: `scalar_`, a
// container keeping its identity and a scalar made JavaScript's,
// `selection_`, the list of a `<select multiple>`, item by item, and
// `choice_`, the value of a control a `bind:group` binds.
const COMPARED = /^__expr_(scalar|selection|choice)_/;
// A prop handed to a child written in Python (`child_`): the Python value
// itself, None the `undefined` it is at every door.
const HANDED = /^__expr_child_/;
// The write half of a binding, `set_`, which an input event calls and not the
// render.
const WRITES = /^__expr_set_/;

const injectable = (one, { declared, names, starred, element }, component) =>
    (component || !one.component) &&
    !declared.includes(one.name) &&
    (!one.whenRead || names.has(one.name)) &&
    (!one.element || element || !starred);

// A locked name is Svelthon's own word (`HOST.reserved`), refused by Bryc.
// The compiler's own prefix (Bryc's `COMPILER_PREFIX`) keeps six families of
// name this file builds out of the author's, `__fn_go`, `__rev_c`, `__bump_c`,
// `__local_n`, `__js_mount`, `__root_loop`, declared in the same scope as the
// author's names, beside `__proto`.
const GENERATED = new RegExp(`^(?:${EXPR_PREFIX}|__inspect_|__effect_)`);

// `refuseLocked` lets those shapes through because the compiler writes them;
// the author's own text must not hold one, or a function the compiler writes
// under that name replaces theirs without a word. Asked of the source as
// written, before anything is added to it, by Python's own tokenizer, so a
// name in a string or a comment is not one.
const NAME_TOKEN = 1;

function refuseGeneratedSpelling(src, source, lineOffset) {
    let tokens;
    try {
        tokens = [...$B.tokenizer(`${$B.unindent(src)}\n`, source, 'file')];
    } catch {
        return; // the compile that follows reports what the tokenizer could not read
    }

    const token = tokens.find((one) => one.type === NAME_TOKEN && GENERATED.test(one.string));
    if (token === undefined) return;

    const line = token.lineno + lineOffset;
    throw refuse(
        `svelthon — \`${token.string}\` is a name the compiler writes itself, for a ` +
            `template expression or an arrow, and one it writes would replace yours; ` +
            `choose another (${source}:${line})`,
        source,
        line
    );
}

function refuseLocked(declared, component, source, lines, lineOffset = 0) {
    // Three shapes the compiler writes into the author's source before it is
    // parsed, the markup pass's expressions and the two the arrow rewrites give
    // a name to, so they arrive here among the declared names. They are
    // the only ones this rule lets through, and they are ours.
    const reserved = declared.find(
        (name) => COMPILER_PREFIX.test(name) && !GENERATED.test(name)
    );

    if (reserved !== undefined) {
        const at = lines?.get(reserved);

        throw refuse(
            `svelthon — \`${reserved}\` starts with \`__\`, which is the compiler's own ` +
                `prefix (${at === undefined ? source : `${source}:${at + lineOffset}`}). It ` +
                `builds names like \`__fn_${reserved}\` and \`__rev_${reserved}\` out of ` +
                `yours, in the same scope, so a name of that shape collides with one of ` +
                `them. Python's own names end with \`__\` as well, \`__all__\` or \`__doc__\`, ` +
                `and those are free.`,
            source,
            at === undefined ? undefined : at + lineOffset
        );
    }

    // `surface()` records where each name was bound, so the refusal names the
    // line the word was taken on (Bryc's `refuseHostWords`). A name that came
    // from `reserved` rather than from a binding has none.
    refuseHostWords(HOST, declared, component, source, lines, lineOffset);
}


// A rune or `@export` on a name already declared: the first declaration decides
// what the name is, so the marker would be dropped. Said at its line, with the
// line that took the name.
function refuseRemarked(remarked, source, lines, lineOffset = 0) {
    const [found] = remarked;

    if (found === undefined) return;

    const first = lines?.get(found.name);
    const line = found.line + lineOffset;

    throw refuse(
        `svelthon — \`${found.name}\` is already declared` +
            (first === undefined ? '' : ` at line ${first + lineOffset}`) +
            `, and \`${found.spelling}\` would be read on a name the first declaration ` +
            `has decided (${source}:${line}). A name carrying a rune or \`@export\` is ` +
            `declared once: drop the earlier one, or rename one of the two.`,
        source,
        line
    );
}

const injections = (c, component) =>
    INJECTED.filter((one) => injectable(one, c, component)).map(
        (one) => `__bind(__proto, '${one.name}', ${one.value}, undefined, undefined, false);`
    );

// The lines those injections need in the component's preamble, before any of
// them is bound.
const injectedPreamble = (c, component) =>
    INJECTED.filter((one) => one.emitted && injectable(one, c, component)).map((one) => one.emitted);

// Module-level names, read off the AST rather than the generated JS, since the
// codegen mangles function names (`increment941818`) but the AST has the truth.
// `bindable()` and `derived()` are markers: the compiler reads them off the AST
// and the injected value is the identity, so nothing of them survives to run.
const isCallTo = (node, name) =>
    node.value instanceof $B.ast.Call &&
    node.value.func instanceof $B.ast.Name &&
    node.value.func.id === name;

// `theirs` says a name is the author's where it is read, an `importjs
// {derived}` among them: a decorator of theirs is no marker of ours.
const hasDecorator = (node, name, theirs = () => false) =>
    !theirs(name) && (node.decorator_list || []).some((d) => d instanceof $B.ast.Name && d.id === name);

// `@effect.pre`, a dotted decorator, which is a different AST node: an
// `Attribute` over a `Name`, not a `Name`. The dotted form is PEP 318's original
// grammar, and the one Python uses to name a variant of something: `@property`
// and `@x.setter`. A standalone `@pre` would promise a composability that does
// not exist.
const hasDottedDecorator = (node, name, attribute, theirs = () => false) =>
    !theirs(name) &&
    (node.decorator_list || []).some(
        (d) =>
            d instanceof $B.ast.Attribute &&
            d.attr === attribute &&
            d.value instanceof $B.ast.Name &&
            d.value.id === name
    );

// A rune lives at the top level of a component's module, and nowhere else.
// `surface()` reads the AST and never descends into a `def` or a `class`, so a
// rune written deeper is built and wired to nothing.
//
// The arrow already refused this, by indentation, before parsing. The decorator
// said nothing at all, so the same construct spoke under one spelling and
// vanished under the other, which is worse than either rule on its own.
const RUNE_NAMES = new Set(['effect', 'derived', 'inspect', 'inspect_with']);

const decoratorSpelling = (node, theirs = () => false) => {
    for (const one of node.decorator_list || []) {
        if (one instanceof $B.ast.Name && RUNE_NAMES.has(one.id) && !theirs(one.id)) return `@${one.id}`;
        if (
            one instanceof $B.ast.Attribute &&
            one.value instanceof $B.ast.Name &&
            RUNE_NAMES.has(one.value.id) &&
            !theirs(one.value.id)
        ) {
            return `@${one.value.id}.${one.attr}`;
        }
    }

    return null;
};

// The runes whose spelling is a call standing alone, `inspect(count)`: the
// top level reads them as a statement, so a deeper one is the same construct.
const STATEMENT_RUNES = new Set(['inspect', 'inspect_with']);

// `effect(f)` and `derived(f)` are the call spelling of a decorator, and at run
// time a decorator is the identity: what the compiler wires is read off a
// declaration. Written as a statement, at any level, the call is a declaration
// of nothing, and the effect would never run.
const BARE_MARKERS = new Set(['effect', 'derived']);

const bareMarker = (node, theirs) => {
    if (!(node instanceof $B.ast.Expr) || !(node.value instanceof $B.ast.Call)) return null;

    const callee = node.value.func;
    const name =
        callee instanceof $B.ast.Name
            ? callee.id
            : callee instanceof $B.ast.Attribute && callee.value instanceof $B.ast.Name
              ? callee.value.id
              : null;

    if (!BARE_MARKERS.has(name) || theirs(name)) return null;

    return callee instanceof $B.ast.Name ? `${name}(…)` : `${name}.${callee.attr}(…)`;
};

// A call to either name is ours unless the name is the author's where it is
// read (`theirs`, see `refuseNestedRunes`), which is theirs to call alone.
function refuseBareMarker(node, source, lineOffset, theirs) {
    const spelling = bareMarker(node, theirs);
    if (spelling === null) return;

    const line = node.lineno + lineOffset;
    const instead = spelling.startsWith('effect')
        ? 'an effect is `=> expression`, or a `def` decorated with `@effect`'
        : 'a derived value is `name => expression`, or a `def` decorated with `@derived`';

    throw refuse(
        `svelthon — \`${spelling}\` written alone declares nothing, so it would never run: ` +
            `${instead} (${source}:${line})`,
        source,
        line
    );
}

// Whether a name is the author's where it is read: one the module imported or
// declared (`theirs`), or one the function or the class `block` binds itself, a
// parameter or a local, which Python reads there whatever it is spelled. `def
// play(sound, effect): effect(sound)` calls the parameter.
const authorsName = (theirs, block) => (name) =>
    theirs.has(name) || (block !== null && block !== undefined && !isGlobalScope(scopeIn(block, name)));

function refuseNestedRunes(body, source, lineOffset, theirs = new Set(), table = null) {
    const authors = (block) => authorsName(theirs, block);

    const called = (node, names, mine) =>
        node.value instanceof $B.ast.Call &&
        node.value.func instanceof $B.ast.Name &&
        names.has(node.value.func.id) &&
        !mine(node.value.func.id);

    const isScope = (node) =>
        node instanceof $B.ast.FunctionDef || node instanceof $B.ast.AsyncFunctionDef || node instanceof $B.ast.ClassDef;

    const scoped = (statements, block) => {
        const mine = authors(block);

        for (const node of statements) {
            refuseBareMarker(node, source, lineOffset, mine);

            const spelling =
                decoratorSpelling(node, mine) ||
                (((node instanceof $B.ast.Assign || node instanceof $B.ast.AnnAssign) && called(node, RUNE_NAMES, mine)) ||
                (node instanceof $B.ast.Expr && called(node, STATEMENT_RUNES, mine))
                    ? `${node.value.func.id}()`
                    : null);

            if (spelling) {
                throw refuse(
                    `svelthon — a rune belongs at the top level of the module, and ` +
                        `\`${spelling}\` is only read there (${source}:${node.lineno + lineOffset})`,
                    source,
                    node.lineno + lineOffset
                );
            }

            const inner = isScope(node) ? table?.blockOf(node) : block;

            for (const key of BODIES) if (node[key]) scoped(node[key], inner);
        }
    };

    // What a `def` or a `class` holds, and what a block of the module holds: an
    // `if`, a loop, a `try`, a `with` or a `match` runs or not, and a rune is
    // wired whether it ran or not. At the top level these are the mechanism
    // itself, since `x => expr` compiles to `x = derived(lambda: …)`.
    for (const node of body) {
        refuseBareMarker(node, source, lineOffset, authors(null));

        if (isScope(node)) {
            scoped(node.body || [], table?.blockOf(node));
            continue;
        }

        for (const key of BODIES) if (node[key]) scoped(node[key], null);
    }
}

// The call spellings of the markers are read in one place each: the whole value
// of an assignment, `twice = derived(…)`, annotated or not, and `inspect(…)` as
// a statement of its own. Anywhere else the call declares nothing and the decorator it stands
// for is the identity at run time, so `print(effect(…))` would never run; and
// `watch = inspect(count)` or `twice = derived(count * 2)` hand a value where a
// function is read, which would raise a bare `TypeError` later, on another
// line.
const CALLED_MARKERS = new Set(['derived', 'effect', 'inspect', 'inspect_with', 'export']);
const SHORT_FORM = {
    derived: 'the short form is `name => expression`',
    effect: 'the short form is `=> expression`',
    export: 'decorate a `def` with `@export`'
};
// What cannot be a function, whatever the names in it are bound to.
const NOT_CALLABLE = [
    'Constant', 'BinOp', 'UnaryOp', 'BoolOp', 'Compare', 'JoinedStr', 'List', 'Tuple', 'Dict', 'Set',
    'ListComp', 'SetComp', 'DictComp', 'GeneratorExp'
];

const markerCalled = (node) => {
    if (!(node instanceof $B.ast.Call)) return null;
    const { func } = node;
    if (func instanceof $B.ast.Name && CALLED_MARKERS.has(func.id)) return func.id;
    if (func instanceof $B.ast.Attribute && func.value instanceof $B.ast.Name && func.value.id === 'effect') return 'effect';
    return null;
};

// `theirs` names what the author took, an `importjs {inspect}` among them; and
// a name the function the call is in binds is the author's too (`authorsName`).
function refuseMisplacedMarkers(body, source, lineOffset, theirs, component, table = null) {
    walkScoped(body, (node, scope, line, parent) => {
        const marker = markerCalled(node);
        if (marker === null || authorsName(theirs, scope === null ? null : table?.blockOf(scope))(marker)) return;

        const at = line + lineOffset;
        const fail = (sentence) => {
            throw refuse(`svelthon — ${sentence} (${source}:${at})`, source, at);
        };
        // An annotated assignment is an assignment, `total: int = derived(…)`
        // read as `total = derived(…)` is, and answers to the same checks.
        const assigned =
            (parent instanceof $B.ast.Assign || parent instanceof $B.ast.AnnAssign) && parent.value === node;

        if (!assigned && !(parent instanceof $B.ast.Expr)) {
            fail(`\`${marker}(…)\` is read only as the whole value of an assignment; inside another expression it declares nothing`);
        }

        // Every `inspect(…)` of a component the rewrite read is an assignment
        // by now, so one still standing as a statement is one it did not: a
        // call sharing its line with another statement, wired to nothing.
        if (component && parent instanceof $B.ast.Expr && (marker === 'inspect' || marker === 'inspect_with')) {
            fail(`\`${marker}(…)\` is read as a statement on lines of its own; sharing one, it is wired to nothing`);
        }

        if (!assigned) return;

        const generated = (parent.targets ?? [parent.target]).every((one) => one instanceof $B.ast.Name && one.id.startsWith('__'));

        if ((marker === 'inspect' || marker === 'inspect_with') && !generated) {
            fail(`\`${marker}(…)\` is a statement of its own, \`${marker}(values)\`; assigned, it is handed values where it reads a function`);
        }

        const [first] = node.args;

        if (first !== undefined && NOT_CALLABLE.some((one) => first instanceof $B.ast[one]) && SHORT_FORM[marker]) {
            fail(`\`${marker}(…)\` takes a function, and is handed a value here; ${SHORT_FORM[marker]}`);
        }
    });
}

// The two assignments that are declarations to the compiler rather than data to
// the module. Both are read off the AST, and neither is state.
const DIRECTIVES = new Set(['__all__', '__js__']);

// The calls that declare what a name is, in their call spelling.
const MARKERS = ['derived', 'effect', 'inspect', 'inspect_with', 'export'];

// `theirs` names what the author imported from JavaScript, an `importjs
// {inspect}` among them: a call to it is theirs, and its value is data.
function surface(body, theirs = new Set()) {
    const mine = (name) => theirs.has(name);
    const marked = (node, name) => !mine(name) && isCallTo(node, name);
    const props = [];
    const bindables = [];
    const defaulted = [];
    const state = [];
    const funcs = [];
    const classes = [];
    const deriveds = [];
    const effects = [];
    const inspects = [];
    const seen = new Set();
    // Names the author wrote and the compiler cannot emit: a JavaScript reserved
    // word makes an invalid `let export = …`. They are dropped, but they were
    // still *declared*, and the locked-name check has to see them, otherwise
    // redefining `export` would be the one silent case left.
    const reserved = [];

    // A rune or `@export` on a name the module already declared, with the line
    // it is written on. The first declaration decides what a name is, so the
    // marker would be read and dropped; it is refused instead.
    const remarked = [];

    // Every name the module binds, whatever the spelling, and *only* to be
    // recognised as taken.
    //
    // The buckets above answer "what is reactive here": an assignment, however
    // it is written, including a walrus, a `global` in a function, a `for`
    // target, a `with … as`, a `match` capture and an import, each of which
    // binds a name of the module to a value as `=` does. A class is declared,
    // not state, and neither is an `except … as`, which Python unbinds when the
    // handler ends.
    //
    // But three other rules read the same list, and for them the question is not
    // "is it reactive", it is "did the author take this word":
    //
    //   1. an injected helper is skipped where the author has a name of that
    //      spelling, so the author's `date` is theirs (and `bind()` writes an
    //      own property besides, belt as well as braces);
    //   2. a JavaScript name from `<script module>` is published the same way,
    //      with the same filter;
    //   3. `refuseLocked` refuses the six words of the dialect, `effect = 0` and
    //      `for effect in …` alike, whatever binds the word.
    //
    // Recorded outside `seen`, so it never competes with a real declaration: a
    // name that is both a `def` and a loop target is still the `def`.
    const bound = [];

    // Whether a `from m import *` binds names here that no statement lists: the
    // runtime gives them their accessors when the import runs (`starred`).
    let starred = false;

    // Where each name was written. Every module-level binding goes through
    // `bind`, whatever statement made it, so one line here answers for all of
    // them, and `refuseLocked` can say which line took one of Svelthon's words
    // instead of naming the file and leaving the reader to search.
    //
    // The first binding wins, the way the refusal reads: an author who writes
    // `effect` twice is told about the first one.
    const lines = new Map();
    let statement;

    const bind = (name) => {
        if (typeof name !== 'string' || !name) return;

        bound.push(name);

        if (!lines.has(name) && typeof statement === 'number') lines.set(name, statement);
    };

    // A name the module assigns a value to, claimed as state the way a plain
    // `x = …` claims one.
    const claim = (name) => {
        if (typeof name !== 'string' || !name || !take(name)) return;

        bind(name);
        state.push(name);
    };

    // The names a `match` pattern captures: `MatchAs` and `MatchStar` bind
    // their `name`, `MatchMapping` its `**rest`, and the others hold patterns.
    const captures = (pattern) => {
        if (!pattern || typeof pattern !== 'object') return;
        if (pattern instanceof $B.ast.MatchAs || pattern instanceof $B.ast.MatchStar) claim(pattern.name);
        if (pattern instanceof $B.ast.MatchMapping) claim(pattern.rest);

        captures(pattern.pattern);
        for (const one of [...(pattern.patterns || []), ...(pattern.kwd_patterns || [])]) captures(one);
    };

    // A target is a name, or a tuple or list of them, nested to any depth:
    // `a, (b, c) = …` is one statement binding three names, each of them state.
    // A `*rest` wraps its name in a `Starred`, which is why the value is
    // followed too.
    const unpacked = (node) => {
        if (!node) return;
        if (node instanceof $B.ast.Starred) return unpacked(node.value);
        if (node instanceof $B.ast.Name) return claim(node.id);

        for (const one of node.elts || []) unpacked(one);
    };

    // `(x := 1)` binds wherever an expression may be written, so it is the one
    // form that cannot be found by looking at statements. Walked over every
    // field rather than over `BODIES`, since a walrus lives in an `if` test, a
    // call's arguments, a comprehension. Stops at a `def` and a `class`, which
    // are scopes of their own and where the rest of this function stops too.
    // Brython's nodes carry a `parent` back up the tree, so a walk over every
    // field is a walk in circles without this.
    const walked = new WeakSet();

    const walruses = (node) => {
        if (!node || typeof node !== 'object') return;
        if (walked.has(node)) return;
        walked.add(node);

        if (Array.isArray(node)) return node.forEach(walruses);

        // A `def`'s body and a `class`'s are scopes of their own; what they
        // evaluate where they are written, in the module's, is not: the
        // decorators, a `def`'s defaults, a class's bases and keywords.
        if (node instanceof $B.ast.FunctionDef || node instanceof $B.ast.AsyncFunctionDef) {
            walruses(node.decorator_list);
            walruses(node.args.defaults);
            walruses(node.args.kw_defaults);
            return;
        }
        if (node instanceof $B.ast.ClassDef) {
            walruses(node.decorator_list);
            walruses(node.bases);
            walruses(node.keywords);
            return;
        }

        // A lambda's body is its own scope; its defaults are read where it is
        // written, in the module's.
        if (node instanceof $B.ast.Lambda) {
            walruses(node.args.defaults);
            walruses(node.args.kw_defaults);
            return;
        }

        if (node instanceof $B.ast.NamedExpr) {
            statement = node.lineno;
            unpacked(node.target);
        }

        for (const key of Object.keys(node)) walruses(node[key]);
    };

    const take = (name) => {
        if (seen.has(name)) return false;
        if (JS_RESERVED.has(name)) {
            // The line as well, because this list is refused now rather than
            // dropped, and a refusal that cannot say where is half a refusal.
            // An `Assign` reaches `take` before `bind`, so a reserved name never
            // goes through the recording below it.
            if (!lines.has(name) && typeof statement === 'number') lines.set(name, statement);

            reserved.push(name);
            return false;
        }
        seen.add(name);
        return true;
    };

    // `total: int = derived(lambda: …)`, a marker under an annotation: what
    // TypeScript's `let total: number = $derived(…)` is to Svelte, a derived
    // with a type. The annotation describes the value and the marker says what
    // the name is, so it is read as the assignment it annotates, and not as a
    // prop whose default would be the lambda itself.
    const annotatedMarker = (node) =>
        node instanceof $B.ast.AnnAssign &&
        node.target instanceof $B.ast.Name &&
        MARKERS.some((one) => marked(node, one));

    const visit = (statements) => {
        for (const node of statements) {
            statement = node.lineno;

            if (node instanceof $B.ast.Assign || annotatedMarker(node)) {
                for (const target of node.targets ?? [node.target]) {
                    // `__all__` and `__js__` are read off the AST by
                    // `declaredExports` and `declaredJsImports`, and read is all
                    // they are for. Left in the buckets they became module
                    // state: a `.svelte.py` published `store.__all__` with a
                    // revision signal, a bump and a read behind it, which is
                    // generated machinery for a compiler directive.
                    if (target instanceof $B.ast.Name && DIRECTIVES.has(target.id)) continue;

                    // `a, b = 0, 0` binds two names of the module, and a name of
                    // the module is state: each one gets its signal, as it would
                    // written on a line of its own.
                    if (!(target instanceof $B.ast.Name)) {
                        unpacked(target);
                        continue;
                    }

                    const called = MARKERS.find((one) => marked(node, one));
                    if (called !== undefined && seen.has(target.id)) {
                        remarked.push({ name: target.id, spelling: `${called}()`, line: node.lineno });
                    }

                    if (!take(target.id)) continue;

                    bind(target.id);

                    // `x => expr` arrives here as `x = derived(lambda: expr)`, and
                    // `=> expr` as `__effect_0 = effect(lambda: expr)`. The emission
                    // below needs no special case for either: it already writes
                    // `$derived.by(() => __fn_x())` and `$effect(() => __fn_x())`,
                    // and a lambda answers a call exactly as a `def` does.
                    if (marked(node, 'derived')) deriveds.push({ name: target.id, arity: 0 });
                    else if (marked(node, 'effect')) effects.push({ name: target.id, arity: 0 });
                    else if (marked(node, 'inspect')) inspects.push({ name: target.id, arity: 0 });
                    // The callable comes first, so the emission takes it off the
                    // front of the evaluated list rather than out of the source.
                    else if (marked(node, 'inspect_with'))
                        inspects.push({ name: target.id, arity: 0, logger: true });
                    // `focus = export(lambda: field.focus())`, the call form of
                    // `@export`, and the shape their own `export const focus =
                    // () => …` has: every marker answers to both spellings. The
                    // arity comes off the lambda, since unlike a derived or an
                    // effect an exported function is called with arguments.
                    else if (marked(node, 'export'))
                        funcs.push({
                            name: target.id,
                            arity: arityOf(node.value.args?.[0]?.args),
                            exported: true
                        });
                    else state.push(target.id);
                }
            } else if (node instanceof $B.ast.AnnAssign) {
                // An annotation is a declaration of interface, like a dataclass
                // field: `name: str` is a prop, `count: int = 0` a prop with a
                // default. A bare assignment stays internal state.
                if (node.target instanceof $B.ast.Name) bind(node.target.id);
                // `bindable(…)` is the marker unless the author imported a
                // `bindable` of their own, which computes the default like any
                // other call, as `derived` and `effect` above.
                if (node.target instanceof $B.ast.Name && take(node.target.id)) {
                    const bindable = marked(node, 'bindable');

                    (bindable ? bindables : props).push(node.target.id);

                    // A default declared, as Svelte reads one off `$bindable(…)`:
                    // `name: str`, `bindable()` and `None` declare none.
                    const value = bindable ? node.value.args[0] : node.value;

                    if (value != null && !(value instanceof $B.ast.Constant && value.value === $B.builtins.None)) {
                        defaulted.push(node.target.id);
                    }
                }
            } else if (
                // `async def` is a different AST node, and an async handler is a
                // function all the same.
                node instanceof $B.ast.FunctionDef ||
                node instanceof $B.ast.AsyncFunctionDef
            ) {
                bind(node.name);

                const decorated = decoratorSpelling(node, mine) ?? (hasDecorator(node, 'export', mine) ? '@export' : null);
                if (decorated !== null && seen.has(node.name)) {
                    // The decorator's own line: it is the marker being refused.
                    const line = Math.min(node.lineno, ...node.decorator_list.map((one) => one.lineno));
                    remarked.push({ name: node.name, spelling: decorated, line });
                }

                if (!take(node.name)) continue;

                // @derived turns a function into a value: Python reads the name and
                // gets the result, exactly like a property. @effect re-runs it
                // whenever something it read has changed, and @effect.pre does the
                // same before the DOM is updated rather than after.
                const pre = hasDottedDecorator(node, 'effect', 'pre', mine);
                const root = hasDottedDecorator(node, 'effect', 'root', mine);
                const entry = {
                    name: node.name,
                    arity: arityOf(node.args),
                    ...(pre ? { pre: true } : {}),
                    ...(root ? { root: true } : {}),
                    // `@export` leaves the function where it was: it is an
                    // ordinary function that is *also* reachable from a parent
                    // holding the instance.
                    ...(hasDecorator(node, 'export', mine) ? { exported: true } : {})
                };
                const bucket = hasDecorator(node, 'derived', mine)
                    ? deriveds
                    : hasDecorator(node, 'effect', mine) || pre || root
                      ? effects
                      : funcs;

                bucket.push(entry);
            } else if (node instanceof $B.ast.ClassDef) {
                // A class is a scope, so nothing inside it is module state, and
                // the descent stops here. The *name* is still the author's.
                bind(node.name);
                if (!classes.includes(node.name)) classes.push(node.name);
            } else {
                // A block is not a scope in Python: a name bound inside `if`,
                // `for`, `try`, `with` or `match` belongs to the module exactly
                // as one written at the left margin does. `def` and `class` are
                // the real scopes, both are taken by name above, and neither is
                // descended into. An `except` handler and a `match` case arrive
                // here as statements of their own and recurse the same way.
                //
                // `for x in …`, `x += 1` and `with a() as x, b() as y:` assign
                // a value to a name of the module, so it is state. An `except
                // … as x` is unbound when the handler ends, and an import
                // declares: those two are taken, not state.
                unpacked(node.target);
                bind(node.name);

                for (const item of node.items || []) unpacked(item.optional_vars);

                // `import json`, `from m import a as b`: the name is bound to what
                // the import found, as `=` binds it, so it is state, and a list
                // imported from a module and appended to repaints the page as
                // `values = values` beside it did. An alias is the name when
                // there is one; a dotted `import a.b` binds `a`; `*` names
                // nothing. A `global` written at the top binds nothing itself.
                for (const alias of node.names || []) {
                    if (typeof alias === 'string') bind(alias);
                    else if (alias.name !== '*') claim(alias.asname || alias.name?.split('.')[0]);
                    else starred = true;
                }

                // `case {"amount": amount}:`, `case [x, *rest]:`, `case P(x=y)
                // as p:` assign their captures in the module too. A value
                // pattern, `case Colour.RED:`, refers to a name and binds none.
                captures(node.pattern);

                for (const key of BODIES) if (node[key]) visit(node[key]);
            }
        }
    };

    visit(body);

    // A `global x` written inside a function creates a module name that no
    // statement at module level declares, and a name of the module is state.
    // Walked over the whole tree, since the point of `global` is that it is
    // written where the descent above stops.
    //
    // Except a name JavaScript imports, which the `global` only reads: it stays
    // the import, and a binding of it is refused (`refuseBoundImports`).
    const globals = (statements) => {
        for (const node of statements) {
            if (node instanceof $B.ast.Global) {
                statement = node.lineno;

                for (const name of node.names || []) {
                    if (theirs.has(name)) continue;

                    bind(name);
                    if (take(name)) state.push(name);
                }
            }

            for (const key of BODIES) if (node[key]) globals(node[key]);
        }
    };

    globals(body);
    walruses(body);

    return { props, bindables, defaulted, state, funcs, classes, deriveds, effects, inspects, reserved, bound, lines, remarked, starred };
}

// The names the emitted script gives to what it generates. Pure functions of the
// author's name. `markup.js` writes calls to the same spellings, and
// `tests/generated-names.test.js` holds the two files to them.
const fn = (name) => `__fn_${name}`;
const local = (name) => `__local_${name}`;

// The JavaScript name of a `def`'s wrapper in a rune script: its own, unless it
// is a rune's. Svelte reads `$state` as a subscription to a store once the script
// binds `state` to an ordinary value, so a wrapper named `state` would turn
// every `$state.raw` of the component into a read of a store declared further
// down, and one named `props` would do the same to `$props()`. A cell is
// declared by a rune and is not read that way. Exported under its own name.
// The runes are the host's list (`HOST.runes`), the one a JavaScript import
// named like one is held under another variable by.
const wrapperName = (name) => (HOST.runes.includes(name) ? `__def_${name}` : name);
// What the parent passes a prop, which a write of the child's overrides, the
// default it falls back on, and the choice between them.
const given = (name) => `__given_${name}`;
const fallback = (name) => `__default_${name}`;
const pick = (name) => `__pick_${name}`;
// A `bindable` prop's last scalar written by Python, beside the number Svelte
// was handed for it (`handOver`), and the default it declares, which Svelte
// reads when the parent leaves it `undefined`.
const crossed = (name) => `__crossed_${name}`;
const bindableDefault = (name) => `__declared_${name}`;
// What the parent passes it, `undefined` when nothing, read past the fallback.
const passed = (name) => `__passed_${name}`;
// What `$effect.root` hands back. Python reads the decorated name and gets
// this, exactly as JavaScript reads `const destroy = $effect.root(…)`, and
// the name belongs to the destructor on both sides.
const destroyer = (name) => `__root_${name}`;

// Whether the component's subscriptions have holders besides the component:
// a root effect, which lives until its destructor is called.
const releases = (c) => !c.store && SUBSCRIBING(c);
const holders = (c) => releases(c) && c.effects.some((e) => e.root);
// Second signal per name: a mutation bumps it without touching the value,
// so nothing is copied and the object keeps its identity.
// The instance's list of subscriptions, and whether it has any to make. A
// component that holds no state and no bindable never calls `track`, so it gets
// neither the list nor the teardown that empties it.
const SUBS = '__subs';

const SUBSCRIBING = (c) =>
    c.state.length > 0 || c.funcs.length > 0 || c.bindables.length > 0 || c.props.length > 0 || c.starred;

// The revision of a name: Svelte's state beside the cell, which a change in
// place of what the cell holds moves (Bryc's `bump`).
const rev = (name) => `__rev_${name}`;

// The component script, one function per section.
//
// Each takes the same context object, what `compile()` read off the source,
// and hands back its lines. They are assembled in `componentSections` order,
// which is load-bearing in four places and asserted by `tests/sections.test.js`.

function preamble(c) {
    return [
        `import { init as __init } from ${JSON.stringify(virtualId(c.name))};`,
        // The bridge behind `__truthy` and the three beside it. Imported under a
        // name no one would type: only generated code touches it, and `py` is a
        // name an author may want.
        `import { ${runtimeAliases(HOST, [
            'bind', '__pybridge', 'jsGlobal', 'track', 'changesNothing', 'follow', 'followOwn', 'SHAPING', 'pyError',
            'pyEvent', 'pyAttach', 'plainData', 'pyArg', 'pyData', 'pyComponent', 'pyExpression',
            'jsCall',
            'ticking', 'pyBind', 'NONE', 'helpers',
            'directiveAction', 'directiveTransition', 'directiveAnimate',
            'plainScalar', 'storeMember', 'invoke',
            ...(c.store ? ['pythonModule'] : SUBSCRIBING(c) ? ['unsubscribe'] : []),
            ...(c.store && c.funcs.some((f) => c.published(f.name)) ? ['liveExport'] : []),
            ...(c.bindables.length ? ['unproxied', 'handOver'] : []),
            // Only an effect and `on_mount` hand a value back to be called
            // later, so only a component with one needs the name.
            ...(c.effects.length || c.lifecycle('on_mount') ? ['pyTeardown'] : []),
            ...(c.effects.some((e) => e.root) ? ['laterRoot'] : []),
            // Three that keep the spelling the markup pass emits, and the read
            // half of the dot, which `templateDots` writes.
            'group', 'readAttr', 'restOf', 'unpackStarred', 'writeAttr', 'writeItem',
            ...(c.templateLine === undefined ? [] : ['templateFrom']),
            ...(c.store ? [] : ['fileLines']),
            ...(c.jsImported.length ? ['readOnlyImport'] : [])
        ])} } from 'svelthon/bridge';`,
        ...c.jsImports.map((one) => jsImportLine(HOST, one)),
        // Under the engine's prefix like every other name it lends: the
        // author's names live in the same scope, and an `importjs { untrack }`
        // or a `def getContext()` of theirs is theirs.
        `import { ${['getContext as __getContext', 'setContext as __setContext', 'getAllContexts as __getAllContexts']
            .concat(c.lifecycle('on_mount') || c.lifecycle('on_destroy') || c.bindables.length ? ['untrack as __untrack'] : [])
            .concat(c.lifecycle('on_destroy') || releases(c) ? ['onDestroy as __onDestroy'] : [])
            .join(', ')} } from 'svelte';`,
        // The three questions the runtime asks of Svelte, answered by runes: a
        // plain module has none. Whether a reaction is reading
        // (`host.reacting` in Bryntime), whether a write would be refused
        // here, asked by a write of the value a state already holds, which
        // Svelte checks and which changes nothing (`host.refuses`), and what marks a
        // state of Svelte's own, which `$state` looks for in the probe it is
        // handed (`stateOwned`).
        `__pybridge.tracking(() => $effect.tracking());`,
        `let __unchanged = $state.raw(0);`,
        `__pybridge.refusing(() => { __unchanged = 0; });`,
        `let __stateProbe = $state(__pybridge.stateProbe());`,
        // And Svelte's own state of an object, which an object whose
        // properties are a getter or a setter is made into as it enters a
        // container (`proxying`): a box of its own at each call, so a write
        // to it is allowed wherever the call is made.
        `class __StateBox { value = $state(); }`,
        `__pybridge.proxying((value) => { const box = new __StateBox(); box.value = value; return box.value; });`,
        ``
    ];
}

function declarations(c) {
    const defaulted = c.bindables.filter((b) => c.defaulted.includes(b));

    return [
        ...(c.bindables.length
            ? [
                  // Svelte's own fallback: a bindable prop the parent leaves
                  // `undefined` reads the default it declares, bound or passed,
                  // and one the child itself wrote `undefined` without a parent
                  // that binds it reads `undefined`. The default is the one
                  // init() writes, after Svelte asks, so Svelte reads it from a
                  // state, lazily, as it reads any default that is not a
                  // literal. It is the default as it crosses (`handOver`), the
                  // form a custom element's reader is handed and one Svelte's
                  // proxy leaves alone, kept beside the Python value, which
                  // Python reads while the parent passes nothing (`passed`).
                  // A custom element's page passes no parent's value Python
                  // can read, so the element reads it whenever the prop holds
                  // that crossing, as it read a value init() handed over.
                  // A prop that declares none, or `None`, has none, as
                  // `$bindable()` and `$bindable(undefined)` have none.
                  ...(defaulted.length ? [`class __Declared { value = $state.raw(); py = undefined; }`] : []),
                  ...defaulted.map((b) => `const ${bindableDefault(b)} = new __Declared();`),
                  `let { ${c.bindables
                      .map((b) =>
                          defaulted.includes(b)
                              ? `${b} = $bindable(${bindableDefault(b)}.value)${c.element ? '' : `, ${b}: ${passed(b)}`}`
                              : `${b} = $bindable()`
                      )
                      .join(', ')}, ...__props } =` + ` $props();`,
                  ...c.bindables.flatMap((b) => [
                      `let ${crossed(b)} = null;`,
                      `let ${rev(b)} = $state.raw(0);`,
                      `const ${bump(b)} = () => { ${rev(b)} += 1; };`
                  ]),
                  // The module body applies the annotation's default by writing
                  // to the name, and that write is the default, which travels
                  // up to no parent. Only writes made after init() are real
                  // ones.
                  `let __initialising = true;`,
                  ``
              ]
            : c.props.length
              ? [`const __props = $props();`, `let __initialising = true;`, ``]
              : []),
        // A prop's value comes from the parent when it was passed, and from the
        // annotation's default otherwise, the default being whatever the Python
        // body assigned during init(). Reading __props keeps it reactive, so a
        // parent update flows into Python's namespace on the next read.
        //
        // A write of the child's own overrides a value the parent passed, as
        // reassigning a prop does in Svelte, until the parent passes one again.
        // Svelte's own rule, read in `props.js`: the write lands on the derived
        // that reads the parent's value, which runs again when the parent
        // writes, even to come back to the value it held. So the override is a
        // mark written on that derived, and a parent's write wipes it. The
        // default init() writes is not an override. A prop passed as
        // `undefined` takes the default, as in Svelte; `null` is a value.
        //
        // Svelte's own rule for the absence, read in `props.js`: the default is
        // the one declared once the parent has passed a value, and a write the
        // child made while nothing was passed until then. So the default
        // declared is kept beside the one an absence reads, and `dirty` says
        // the parent passed a value since, as Svelte's `fallback_dirty` does.
        //
        // And the write is Svelte's: it lands on the derived without reading
        // it, compared as Svelte compares a prop's write, `===` on what
        // JavaScript holds, a scalar by its value. A child writing again the
        // value it wrote leaves the derived as it was, so a parent's write not
        // read yet still wins at the next read. Read first, the write took the
        // parent's value in and then hid it under the child's. What the
        // derived holds is kept beside it (`current`) and written again when
        // the write is the same scalar: a Python parent passes its own float,
        // None or string, never `===` to the child's.
        ...c.props.flatMap((n) => [
            `let ${local(n)} = $state.raw(undefined);`,
            `let ${rev(n)} = $state.raw(0);`,
            `const ${fallback(n)} = { declared: undefined, value: undefined, dirty: true, overridden: false, absent: false, current: undefined };`,
            `const ${bump(n)} = () => { ${rev(n)} += 1; };`,
            // What JavaScript holds, as Svelte's derived holds it, which a write
            // is compared with: the default's own Python value is kept beside
            // it, and read when the derived stands for the absence.
            `let ${given(n)} = $derived.by(() => {` +
                ` ${fallback(n)}.overridden = false;` +
                ` const __passed = __props.${n};` +
                ` ${fallback(n)}.absent = __passed === undefined;` +
                ` if (!${fallback(n)}.absent) { ${fallback(n)}.dirty = true; return (${fallback(n)}.current = __passed); }` +
                ` if (${fallback(n)}.dirty) { ${fallback(n)}.dirty = false; ${fallback(n)}.value = ${fallback(n)}.declared; }` +
                ` return (${fallback(n)}.current = __plainScalar(${fallback(n)}.value)); });`,
            `const ${pick(n)} = () => {` +
                ` const __held = ${given(n)};` +
                ` return ${fallback(n)}.overridden ? ${local(n)} : ${fallback(n)}.absent ? ${fallback(n)}.value : __held; };`,
            // Read by Svelte's own compiler and not by ours: a snippet is a
            // prop, and `{@render name(…)}` references the bare name. Python
            // reaches the same value through the namespace accessor below, and
            // that is the copy a falsy value has to survive. This one is
            // Svelte's, so its absence is JavaScript's: None is `undefined`,
            // which `{@render name?.()}` skips as it skips an omitted prop.
            `const ${n} = $derived.by(() => { ${rev(n)}; const __given = ${pick(n)}(); return __given === __NONE ? undefined : __given; });`
        ]),
        ...c.state.flatMap((n) => stateCell(HOST, n, n)),
        // A `def`'s cell is a state cell: a decorator or a later line may put a
        // list there, and its mutations are followed as any name's are.
        ...c.funcs.flatMap((f) => stateCell(HOST, f.name, fn(f.name))),
        ...c.inspects.map((i) => `let ${fn(i.name)} = $state.raw(undefined);`),
        ...c.effects.flatMap((e) =>
            e.root
                ? [`let ${fn(e.name)} = $state.raw(undefined);`, `let ${destroyer(e.name)} = ${RUNTIME.laterRoot}();`]
                : [`let ${fn(e.name)} = $state.raw(undefined);`]
        ),
        // A @derived name reads as its result, on both sides. The body runs
        // inside $derived.by, and every global it touches goes through a
        // namespace accessor, so Svelte discovers the dependencies by itself.
        ...c.deriveds.flatMap((d) => [
            `let ${fn(d.name)} = $state.raw(undefined);`,
            `const ${d.name} = $derived.by(() => __invoke(${fn(d.name)}));`
        ]),
        // Which containers this instance signed onto, so it can sign off when
        // it goes. A container reached through a store outlives the components
        // that read it, and `track` only ever added.
        //
        // A store has no list, and that is the rule rather than an omission: its
        // own subscription is the module's, it is made once and it lasts as long
        // as the page does.
        //
        // The list is let go once, when the instance goes (`__leave`), and the
        // way it goes is laid down before anything can fail. A construction
        // that raises, in the script, the template or an effect, is torn down
        // by its boundary before any `onDestroy` has run, since Svelte's runs
        // as a deferred effect: an effect run at once (`$effect.pre`) leaves its
        // teardown in place from the start. `onDestroy` is the server's, which
        // runs no effect and calls it when a render closes.
        //
        // A root outlives the component and reads the same names, so with roots
        // the list goes when the last of them lets go: the component gone and
        // every root destroyed, each root counting itself in when it starts.
        ...(releases(c)
            ? [
                  `const ${SUBS} = [];`,
                  ...(holders(c)
                      ? [`let __holders = 1;`, `const __release = () => { if (--__holders === 0) __unsubscribe(${SUBS}); };`]
                      : []),
                  `let __gone = false;`,
                  `const __leave = () => { if (__gone) return; __gone = true; ${holders(c) ? '__release();' : `__unsubscribe(${SUBS});`} };`,
                  `$effect.pre(() => __leave);`,
                  `__onDestroy(__leave);`
              ]
            : []),
        // How an error's Python line becomes a line of this file; see `inFile`
        // in the runtime. Only a component has template functions to place.
        // Registered under the file, the one place a frame's line is placed
        // from, whoever called the function: a callback a library keeps, a
        // handler another component set, a function another file reached.
        ...(c.store ? [] : [`__fileLines(${JSON.stringify(c.source)}, ${JSON.stringify(c.lines)});`]),
        // Where the template's own code begins in the module's source, so that
        // a read made there is the template's however deep it is written.
        ...(c.templateLine === undefined
            ? []
            : [`__templateFrom(${JSON.stringify(c.source)}, ${c.templateLine});`]),
        ``
    ];
}

// What a compiled template expression calls, and only a `.svelte` has one: a
// `.svelte.py` holds signals but no markup, exactly as a plain `.py` holds
// neither.
function templateBridge(c) {
    if (c.store) return [];

    return [
        `const __event = (fn) => __pyEvent(fn);`,
        `const __attach = (fn) => __pyAttach(fn);`,
        // What an `{#each}` walks, declared beside it by the markup, `{const
        // __rows_… = __collection(…)}` read as `{#each __rows_…() as row}`:
        // the iterable evaluated in a derived, as Svelte evaluates a block's
        // collection, so a write made while the template walks is refused
        // there too, and wrapped, so a list changed in place, the same object,
        // still reaches the effect placed before the block, which
        // moves the block's revision only when the rows differ
        // (`__pybridge.walk`), and which a keyed block's walk tells of a
        // change under any row it holds (`watch`), its key maybe moved. A
        // derived alone would not do: Svelte runs a
        // block again, unasked, whenever an effect writes something it reaches
        // through deriveds, and a thousand selects written as they mount ran it
        // a thousand times. Written here, in runes, since the runtime knows no
        // host; a server, which has no effect, takes the rows as the block
        // reads them.
        `const __collection = (compute, keyOf) => {`,
        `    const walk = __pybridge.walk(keyOf);`,
        `    const yielded = $derived.by(() => ({ rows: walk.computed(compute) }));`,
        `    let revision = $state.raw(0);`,
        `    let count = 0;`,
        `    $effect.pre(() => { walk.watch(); if (walk.refresh(yielded.rows)) revision = ++count; });`,
        `    const rows = () => (revision, walk.held === undefined && walk.refresh(yielded.rows), walk.held);`,
        `    rows.noted = walk.noted;`,
        `    return rows;`,
        `};`,
        // What `(name := value)` in a handler compiles to. The write goes
        // through the namespace, so through the accessor, so the signal fires:
        // the whole reason the walrus can mean this here.
        `const __assign = (name, value) => { ${NS}[name] = value; return value; };`
        // The same walrus aimed at an attribute or a key rather than a name,
        // and `bind:group`'s action, are imported under the names the markup
        // pass emits (`__setattr`, `__setitem`, `__group`) rather than
        // assigned here from a bare one an author could have declared.
    ];
}

// One signal per module-level name, published to Brython as an accessor.
// Everything the compiler adds is bound after this, in `injectedBindings`;
// bound before, an injection would silently take a name the author declared.
//
// The namespace must NOT be a $state proxy: Svelte would deep-proxy every
// Python value stored in it, and a proxied Brython object fails its own type
// checks (`repr((1, 2))` raises "descriptor '__repr__' requires a 'tuple'
// object but received a 'tuple'"). $state.raw keeps values opaque, so the cell
// follows *rebinding a name*, and a revision signal beside it follows a
// mutation in place: `__track` marks the container, and `items.append(x)` bumps
// the revision every reader also reads, the object keeping its identity.
//
// The names `class` binds that no other binding of the module takes.
const declaredClasses = (c) => {
    const taken = new Set([...c.props, ...c.bindables, ...c.state, ...[...c.funcs, ...c.deriveds, ...c.effects, ...c.inspects].map((one) => one.name)]);

    return c.classes.filter((name) => !taken.has(name));
};

function authorBindings(c) {
    return [
        // The namespace inherits its bindings' accessors and nothing else: a
        // name the program never bound, `constructor` or `toString`, is
        // unbound, where `Object.prototype` answered it with a function.
        `const __proto = __global.Object.create(null);`,
        // The names a `from m import *` binds get their accessors at run time,
        // in a component unsubscribed with its own list; a store keeps its
        // subscriptions for as long as the page, and notes each under `names`,
        // which it publishes when it has no `__all__` (`starredMembers`).
        ...(c.starred
            ? [`__global.Object.defineProperty(__proto, '$bryntimeStarred', { value: { owner: ${c.store ? 'undefined, names: new __global.Set()' : SUBS} } });`]
            : []),
        // Python may write to a prop; the write lands in the local fallback and
        // is shadowed for as long as the parent supplies a value, which is
        // Svelte's own rule for non-bindable props.
        //
        // The accessors read the raw cell, never the tracked binding: Python must
        // not subscribe to Svelte's graph, only feed it.
        //
        // What a parent hands over may be JavaScript's: `pyBind` makes a
        // fractional number a float and an absence None, as at a binding.
        //
        // The fallback is the component's own, so a container in it is watched
        // like any state's: `rows.append(1)` on a default repaints its readers.
        //
        // A write after init() overrides what the parent passed, or is the
        // value of this absence, and either way what was read before it may
        // not have been the cell it lands in: the revision every reader reads
        // is moved, as a write to an override is a write to Svelte's own
        // derived. Unless it changes nothing Python reads (`changesNothing`),
        // told by what the derived held when it was last read, and not by a
        // read of it, which would take a parent's write in: then the prop is
        // left as it was, as Svelte leaves a state written the value it holds.
        ...c.props.map(
            (n) =>
                `__bind(__proto, '${n}', () => (__SHAPING.on ? (${local(n)}, __followOwn(__pyBind(${pick(n)}()))) : (${rev(n)}, __follow(__pyBind(${pick(n)}())))),` +
                ` (${NEXT_VALUE}) => { const __held = ${bump(n)}.held; const __written = __track(${NEXT_VALUE}, ${bump(n)}, ${SUBS});` +
                ` if (__initialising) { ${fallback(n)}.declared = __written; ${fallback(n)}.value = __written; ${local(n)} = __written; return; }` +
                ` if (__changesNothing(__written, __pyBind(${fallback(n)}.overridden ? __held : ${fallback(n)}.absent ? ${fallback(n)}.value : ${fallback(n)}.current))) return;` +
                ` const __plain = __plainScalar(__written);` +
                ` if (__plainScalar(${fallback(n)}.current) !== __plain) ${fallback(n)}.current = __plain;` +
                ` ${given(n)} = ${fallback(n)}.current; ${fallback(n)}.overridden = true;` +
                ` if (${fallback(n)}.value !== undefined) ${fallback(n)}.value = __written;` +
                ` ${local(n)} = __written; ${bump(n)}(); },` +
                ` () => ${pick(n)}());`
        ),
        // What Python writes goes up as JavaScript's own, a scalar its number
        // and a container its view, its original kept beside it (`handOver`),
        // which `unproxied` gives Python again while the prop still holds what
        // the write handed over; a parent's setter may decide otherwise.
        //
        // What init() writes to a prop that declares a default is that
        // default, Svelte's fallback, the last write winning as for any prop.
        // One that declares none has no fallback, so init() writes it to the
        // prop while the parent passes nothing. And so does a server, where
        // Svelte reads a fallback as the props are destructured, before init()
        // has written it.
        //
        // Two Python values may cross as one number, `15` and `15.0`, where
        // Svelte sees no change: what Python reads is then what moves the
        // revision its readers read. And one value read as two objects, the
        // float a JavaScript number reads as and the float written over it,
        // moves nothing (`changesNothing`).
        ...c.bindables.map((b) => {
            const declared = c.defaulted.includes(b);
            const box = bindableDefault(b);
            const held = declared
                ? `__unproxied(${b}, ${crossed(b)}, ${c.element ? 'undefined' : passed(b)}, ${box})`
                : `__unproxied(${b}, ${crossed(b)})`;
            const written = `const __written = __track(${NEXT_VALUE}, ${bump(b)}${c.store ? '' : `, ${SUBS}`});`;
            const handed =
                `const __was = __untrack(() => ${held});` +
                ` ${crossed(b)} = __handOver(__written, (__crossing) => { ${b} = __crossing; });` +
                ` if (!__changesNothing(__pyBind(__untrack(() => ${held})), __pyBind(__was))) ${bump(b)}();`;
            const set = declared
                ? `${written} if (__initialising) { ${box}.py = __written;` +
                  ` __handOver(__written, (__crossing) => { ${box}.value = __crossing; });` +
                  ` if (${b} !== undefined) return; } ${handed}`
                : `if (!__initialising || ${b} === undefined) { ${written} ${handed} }`;
            return (
                `__bind(__proto, '${b}', () => (__SHAPING.on ? __followOwn(__pyBind(${held})) : (${rev(b)}, __follow(__pyBind(${held})))),` +
                ` (${NEXT_VALUE}) => { ${set} }, () => ${b});`
            );
        }),
        // Bryc's accessor (`stateBinding`): the rows of an `{#each}` follow
        // the value's own changes and what they read under it
        // (`__pybridge.walk`).
        ...c.state.map((n) => stateBinding(HOST, n, n, { subs: c.store ? null : SUBS })),
        // A name bound by `class` is declared, no state: no revision, no watch.
        // Its accessor follows, in a reaction, the special methods its
        // metaclass gives it when the metaclass is the author's
        // (`__pybridge.declared`), which an operation on the class looks up and
        // no read names; any other class is written as the namespace's own
        // property as its statement runs (`__pybridge.declare`), and read as
        // any name is. A name another binding gives an accessor keeps that one.
        ...declaredClasses(c).flatMap((n, at) => [
            ...(at === 0 ? ['const __classes = __global.Object.create(null);'] : []),
            `__bind(__proto, '${n}', () => __pybridge.declared(__classes[${JSON.stringify(n)}]), function (${NEXT_VALUE}) { __pybridge.declare(this, '${n}', ${NEXT_VALUE}, __classes); });`
        ]),
        ...c.funcs.map((f) => stateBinding(HOST, f.name, fn(f.name), { subs: c.store ? null : SUBS, held: fn(f.name) })),
        ...c.inspects.map(
            (i) => `__bind(__proto, '${i.name}', () => ${fn(i.name)}, (${NEXT_VALUE}) => { ${fn(i.name)} = ${NEXT_VALUE}; });`
        ),
        // A root's name reads as its destructor, once its `def` has run and
        // before the root is made (`laterRoot`); the setter still takes the
        // function, since that is what Brython writes when the `def` runs.
        ...c.effects.map((e) =>
            e.root
                ? `__bind(__proto, '${e.name}', () => (${fn(e.name)} === undefined ? undefined : ${destroyer(e.name)}.stop), ` +
                  `(${NEXT_VALUE}) => { ${fn(e.name)} = ${NEXT_VALUE}; }, () => ${fn(e.name)});`
                : `__bind(__proto, '${e.name}', () => ${fn(e.name)}, (${NEXT_VALUE}) => { ${fn(e.name)} = ${NEXT_VALUE}; });`
        ),
        // __follow(): a @derived that hands back a container it was given is the one
        // place the revision cannot travel by itself: Svelte memoises the
        // derived on `===`, so the reader subscribes to the object instead.
        ...c.deriveds.map(
            (d) =>
                `__bind(__proto, '${d.name}', () => __follow(${d.name}), (${NEXT_VALUE}) => { ${fn(d.name)} = ${NEXT_VALUE}; }, () => ${fn(d.name)}, true, true);`
        )
    ];
}

// A module's is replaced by a new one when its body raises (`moduleLoad`).
function componentNamespace(c) {
    return [``, ...namespaceObject(HOST, { name: c.namespace, replaced: c.store })];
}


// Everything the compiler adds: the injected helpers, the template bridge's
// entries, the JavaScript names and the Python modules a directive names. All
// of it after `authorBindings`, so a name the author declared always wins.
function injectedBindings(c) {
    return [
        ...injectedPreamble(c, true),
        ...injections(c, true),

        // Wrappers for compiled template expressions. Not Python's own bool()
        // and str(): a template may hold a foreign JavaScript value, a DOM node
        // from bind:this, on which Brython's classifier trips. These fall back.
        ...(c.store
            ? []
            : [
                  `__bind(__proto, '__truthy', () => __pybridge.truthy);`,
                  `__bind(__proto, '__hidden', () => __pybridge.hidden);`,
                  `__bind(__proto, '__text', () => __pybridge.str);`,
                  `__bind(__proto, '__seq', () => __pybridge.seq);`,
                  `__bind(__proto, '__key', () => __pybridge.key);`,
                  `__bind(__proto, '__class', () => __pybridge.klass);`,
                  // A handler in a spread is adapted as one written by name.
                  `__bind(__proto, '__spreadElement', () => (value) => __pybridge.spreadElement(value, __event));`,
                  // And on a control a `bind:group` binds, its `value` as the group reads it.
                  `__bind(__proto, '__spreadChoice', () => (value) => __pybridge.spreadElement(value, __event, true));`,
                  // And on a custom element, whose properties take the values as they are.
                  `__bind(__proto, '__spreadCustom', () => (value) => __pybridge.spreadElement(value, __event, false, true));`,
                  `__bind(__proto, '__spread', () => __pybridge.spread);`,
                  `__bind(__proto, '__spreadPython', () => __pybridge.spreadPython);`,
                  `__bind(__proto, '__bound', () => __pybridge.bound);`,
                  `__bind(__proto, '__assign', () => __assign);`,
                  `__bind(__proto, '__getattr', () => __getattr);`,
                  `__bind(__proto, '__rest', () => __rest);`,
                  `__bind(__proto, '__unpack', () => __unpack);`,
                  `__bind(__proto, '__setattr', () => __setattr);`,
                  `__bind(__proto, '__setitem', () => __setitem);`
              ]),
        // The second argument is what the component imported in its
        // `<script module>`, published so Python can read it.
        ...jsNameBindings(HOST, c, c.jsNames)
    ];
}

// Running the module body, which is what fills every cell the sections above
// declared. Nothing that reads a Python name may come before it.
// A store's name as JavaScript reads it, from `value`, the expression that reads
// what it holds now; `call` is a `def`'s own wrapper.
const storeRead = (c, name, value, call) =>
    `${RUNTIME.storeMember}(${value}, ${JSON.stringify(`${name}() — ${c.source}`)}${call === undefined ? '' : `, ${call}`})`;


// And the names those star imports brought, on a store with no `__all__`: it
// publishes every name it has, and these the source does not spell. Each the
// way a name the compiler gave no signal is published, read and written
// through the namespace.
const starredMembers = (c) =>
    c.store && c.starred && !c.listsAll
        ? [
              `for (const __name of ${NS}.$bryntimeStarred.names) {` +
                  ` if (__global.Object.hasOwn(${STORE_FACADE}, __name)) continue;` +
                  ` __global.Object.defineProperty(${STORE_FACADE}, __name, { enumerable: true,` +
                  ` get: () => ${RUNTIME.storeMember}(${NS}[__name], __name + ${JSON.stringify(`() — ${c.source}`)}),` +
                  ` set: (${NEXT_VALUE}) => { ${NS}[__name] = __pyArg(${NEXT_VALUE}); } }); }`
          ]
        : [];

function initCall(c) {
    // A module's body runs when it is imported (`moduleLoad`).
    if (c.store) return [];

    return [
        ``,
        `__init(${NS});`,
        ...unboundRefusals(HOST, c.unbound, c.listedAt),
        ...(c.bindables.length || c.props.length ? [`__initialising = false;`] : []),
        ``
    ];
}

function instanceExports(c) {
    return [
        // Event handlers are called with a DOM event Python never asked for.
        // Truncating to the declared arity is a placeholder for a real interop
        // policy (jsobj2pyobj on demand), enough to make handlers work.
        // An uncaught Python exception arrives in JS without message or stack;
        // pyError fills them in, naming the function and the file it came from.
        // `pyComponent`, and not a wrapper written out here: a rule added to the
        // runtime's own reaches this boundary too.
        // A **reader** for the component's own functions, and the written-out
        // call for a template expression. The two wrappers differ in what they
        // are given because they differ in what the name means: an author's
        // `def` may sit under a decorator, so its value has to be read at the
        // call, and an `__expr_N` is this compiler's own and never moves.
        ...c.funcs.map((f) =>
            componentWrapper(f) === RUNTIME.pyExpression
                ? `const ${wrapperName(f.name)} = ${RUNTIME.pyExpression}((a) => ${fn(f.name)}(...a), ` +
                  `${JSON.stringify(`${f.name}() — ${c.source}`)}, ${f.arity === Infinity ? '1 / 0' : f.arity}, ` +
                  `${KEPT_PYTHON.test(f.name) ? 'true' : HANDED.test(f.name) ? `'child'` : COMPARED.test(f.name) ? `'${f.name.match(COMPARED)[1]}'` : 'false'}` +
                  `${WRITES.test(f.name) ? ', true' : ''});`
                : `const ${wrapperName(f.name)} = ${RUNTIME.pyComponent}(() => ${fn(f.name)}, ` +
                  `${JSON.stringify(`${f.name}() — ${c.source}`)}${f.exported && !c.store ? ', true' : ''});`
        ),
        // What a parent holding `bind:this` can call. Svelte gathers whatever an
        // instance script exports into `$$exports` and hands that object back,
        // so a specifier list is enough: `export { focus }` becomes
        // `var $$exports = { focus }`.
        //
        // A component with no `@export` exports nothing, which is theirs too: an
        // instance exposes only what it says it exposes.
        ...(!c.store && c.funcs.some((f) => f.exported)
            ? [
                  ``,
                  `export { ${c.funcs
                      .filter((f) => f.exported)
                      .map((f) => (wrapperName(f.name) === f.name ? f.name : `${wrapperName(f.name)} as ${f.name}`))
                      .join(', ')} };`
              ]
            : []),
        ...(c.store
            ? [
                  ``,
                  // Module-scope signals live once for the whole app. Exported
                  // through getters because Svelte forbids exporting a reassigned
                  // $state binding directly, and a getter is what keeps the read
                  // reactive at the call site.
                  // `__all__` says what a module exports, here as in a `.py`:
                  // `c.published` lets every name through when the module wrote
                  // no `__all__`, and only the listed ones when it did.
                  //
                  // What a getter hands JavaScript is a crossing too, the other
                  // way, decided by the value the name holds when it is read and
                  // not by what bound the name: `__storeMember` makes a float a
                  // number, keeps a container itself, and hands a Python
                  // callable over as a call, a `def` through its own wrapper.
                  //
                  // Under a name of the compiler's, and exported as `store`:
                  // `store` may be a name of the module's own, whose cell or
                  // derived is declared under it in this same scope.
                  `const ${STORE_FACADE} = {`,
                  ...c.state
                      .filter(c.published)
                      .map((n) => `    get ${n}() { return (${rev(n)}, ${storeRead(c, n, n)}); },`),
                  ...c.unsignalled.map((n) => `    get ${n}() { return ${storeRead(c, n, `${NS}.${n}`)}; },`),
                  // The parameter and the name its body reads are one constant.
                  // `__pyArg`, because this setter is a **crossing**:
                  // `store.amount = 0.25` puts a Python float where Python
                  // expects one, as `store.set_amount(0.25)` does. The table of
                  // crossings in bridge.js lists this door and its getter.
                  //
                  // The same conversion the call boundary owes, and no more: a
                  // scalar becomes its Python self and an object keeps its
                  // identity, so a JavaScript array assigned to a store is still
                  // that array. Converting containers too would be a change of
                  // contract, not a repair.
                  //
                  // Written through the namespace, as a Python assignment is:
                  // its accessor is the one door that tracks the value and puts
                  // back a name `del` removed.
                  ...c.state
                      .filter(c.published)
                      .map((n) => `    set ${n}(${NEXT_VALUE}) { ${NS}.${n} = __pyArg(${NEXT_VALUE}); },`),
                  ...c.unsignalled.map((n) => `    set ${n}(${NEXT_VALUE}) { ${NS}.${n} = __pyArg(${NEXT_VALUE}); },`),
                  ...c.deriveds
                      .filter((d) => c.published(d.name))
                      .map((d) => `    get ${d.name}() { return ${storeRead(c, d.name, `__follow(${d.name})`)}; },`),
                  ...c.funcs
                      .filter((f) => c.published(f.name))
                      .map((f) => `    get ${f.name}() { return ${storeRead(c, f.name, `${NS}.${f.name}`, wrapperName(f.name))}; },`),
                  `};`,
                  `export { ${STORE_FACADE} as store };`,
                  // Its default export too, made by the module JavaScript
                  // imports (`svelthon.js`, `eagerModule`).
                  //
                  // Named exports too: a `.py` is not only a store. SvelteKit
                  // looks for `load`, `actions`, `GET`, by name, on the module.
                  // Live, as a `.py` publishes its own: the value the name holds
                  // now, a `def` a decorator turned into data published as data,
                  // a number written over a `def` as that number, and nothing
                  // after `del`, as the getter above reads it. Through the
                  // namespace: the cell itself read at the top of the module is
                  // what Svelte reports as `state_referenced_locally`.
                  ...(storeExports(c).length
                      ? [
                            ``,
                            ...storeExports(c).map((f) => `let __export_${f.name};`),
                            `export { ${storeExports(c)
                                .map((f) => `__export_${f.name} as ${f.name}`)
                                .join(', ')} };`
                        ]
                      : [])
              ]
            : [])
    ];
}

// Last, because an effect runs its body the moment it is created: anything it
// reads has to exist, and that means every wrapper above it. A module's run
// with its body, when it is imported (`moduleLoad`).
function effectBlocks(c) {
    return c.store ? [] : effectLines(c);
}

function effectLines(c) {
    return [
        // Deliberately *not* untracked: discovering what the body read is the
        // whole point. A Python function that returns a callable hands back a
        // teardown, exactly as a Svelte effect does.
        // `$inspect` is given the call, not its result: Svelte wraps whatever it
        // receives in a thunk of its own and re-reads it on every change, so the
        // lambda is re-run and the namespace accessors do the tracking. A
        // production build drops the whole line, theirs and not ours.
        // The lambda is called *inside* the rune both times, never hoisted into a
        // const first: hoisting reads the values once, outside the tracking
        // context, and the logger then fires on `init` and never again.
        //
        // The `.with(…)` argument is the exception to that: it is an ordinary
        // expression, evaluated once outside any tracking context, and reading
        // the cell there is what `state_referenced_locally` reports, twice per
        // `inspect_with`, on every build, at a line past the end of the author's
        // file and about a name they cannot have. Reading it *inside* the
        // handler answers the warning and is the same call: the handler an
        // author hands over does not change for the component's life, so the
        // value read late is the value read early.
        ...c.inspects.map((i) =>
            i.logger
                ? `$inspect(...__invoke(__invoke(${fn(i.name)})[0])).with((...a) => __event(__invoke(__invoke(${fn(i.name)})[1]))(...a));`
                : `$inspect(...__invoke(${fn(i.name)}));`
        ),
        // A root owns its own scope: it is not cleaned up when the component is,
        // which is the point: the destructor is handed to Python under the
        // decorated name, and calling it is what ends the effect.
        ...c.effects.flatMap((e) => [
            ``,
            // `root` is a scope and `pre` is a moment, so they compose rather
            // than exclude each other, which is what stacking the two
            // decorators says, and what the nesting emits.
            e.root
                ? `${destroyer(e.name)}.start(() => $effect.root(() => { $effect${e.pre ? '.pre' : ''}(() => {`
                : `$effect${e.pre ? '.pre' : ''}(() => {`,
            `    let teardown;`,
            `    try { teardown = __invoke(${fn(e.name)}); }` +
                ` catch (err) { throw __pyError(err,${JSON.stringify(`${e.name}() — ${c.source}`)}); }`,
            // What an effect hands back is a *Python* value, so the question is
            // whether Python can call it, not whether JavaScript can. A bound
            // method, `resource.close`, the plainest teardown there is, is a
            // Brython object that `typeof` calls `object`, and so is a callable
            // instance. `pyTeardown` answers the wide question and hands back
            // something JavaScript can call, receiver included, or nothing. An
            // `async def` hands back a coroutine, which it starts instead.
            `    const __cleanup = ${RUNTIME.pyTeardown}(teardown, ${JSON.stringify(`${e.name}() — ${c.source}`)});`,
            `    if (__cleanup) return () => { __cleanup(); };`,
            e.root ? (holders(c) ? `}); __holders += 1; return __release; }));` : `}); }));`) : `});`
        ]),
        // untrack, because a hook reads the component's names through the
        // namespace accessors, and those reads are signal reads. `mounts += 1`
        // inside on_mount would otherwise make the effect depend on state it
        // also writes, and Svelte loops until it gives up with
        // effect_update_depth_exceeded.
        //
        // A hook is the value its name holds once the script has run, not the
        // `def` the compiler saw: a `def` under an `if` not taken leaves the
        // name unbound, which here is `undefined`, as `del` leaves it, and a
        // hook nobody bound is not called, as Svelte's `onMount` in a branch
        // not taken is never registered. Any other value is called and reports
        // its own error. Held in the wrapper a hook goes through, which starts
        // an `async def` and places an error.
        //
        // What `on_mount` hands back is its cleanup, as with Svelte's
        // `onMount`, and it runs before `on_destroy`: Svelte tears a
        // component's effects down in the order they were made.
        ...(c.lifecycle('on_mount')
            ? [
                  ``,
                  `$effect(() => {`,
                  `    const __mounted = __untrack(() => ${c.hook('on_mount')});`,
                  `    const __unmounted = __mounted === undefined ? undefined :` +
                      ` ${RUNTIME.pyTeardown}(__untrack(() => __pyComponent(() => __mounted, ${JSON.stringify(`on_mount() — ${c.source}`)})()),` +
                      ` ${JSON.stringify(`on_mount() — ${c.source}`)});`,
                  `    if (__unmounted) return () => { __unmounted(); };`,
                  `});`
              ]
            : []),
        // Through Svelte's `onDestroy`, which the server's renderer calls when
        // a render closes, as the client calls it when the component goes.
        // Captured while the component is alive: read from a teardown, once
        // destroyed, the name yields no function at all.
        ...(c.lifecycle('on_destroy')
            ? [
                  ``,
                  `const __teardown = __untrack(() => { const held = ${c.hook('on_destroy')};` +
                      ` return held === undefined ? undefined : __pyComponent(() => held, ${JSON.stringify(`on_destroy() — ${c.source}`)}); });`,
                  `if (__teardown !== undefined) __onDestroy(__teardown);`
              ]
            : [])
    ];
}

// The plain module: a `.py` compiled to ordinary JavaScript. No runes, so no
// need for the Svelte compiler and no need to be renamed `.svelte.js`, which is
// what lets SvelteKit find a `+page.server.py` in its manifest. It is the mirror
// of a plain `.ts` next to a `.svelte.ts`.
//
// The same five moments as a component, minus everything a template needs.

function plainPreamble(c) {
    return [
        `import { init as __init } from ${JSON.stringify(virtualId(c.name))};`,
        `import { ${runtimeAliases(HOST, [
            'bind', '__pybridge', 'jsGlobal', 'pyCall', 'pyError', 'plainData', 'pyArg',
            'pyData', 'pyExport', 'jsCall', 'ticking', 'pyBind', 'NONE', 'helpers',
            'pythonModule', 'group', 'invoke', 'liveExport', 'readOnlyImport'
        ])} } from 'svelthon/bridge';`,
        ...c.jsImports.map((one) => jsImportLine(HOST, one)),
        ``
    ];
}

function plainDeclarations(c) {
    return [
        ...c.state.map((n) => `let ${n};`),
        ...[...c.funcs, ...c.plainDeriveds].map((f) => `let ${fn(f.name)};`),
        ``
    ];
}

function plainBindings(c) {
    return [
        // No markup here, so none of what a template expression calls (`__event`,
        // `__assign`, `__group`, `__truthy` and the rest) is emitted. Nothing
        // of `Object.prototype` is a name, as in `authorBindings`.
        `const __proto = __global.Object.create(null);`,
        ...c.state.map((n) => `__bind(__proto, '${n}', () => ${n}, (${NEXT_VALUE}) => { ${n} = ${NEXT_VALUE}; });`),
        ...c.funcs.map(
            (f) =>
                `__bind(__proto, '${f.name}', () => ${fn(f.name)}, (${NEXT_VALUE}) => { ${fn(f.name)} = ${NEXT_VALUE}; }, () => ${fn(f.name)});`
        ),
        ...c.plainDeriveds.map(
            (d) =>
                `__bind(__proto, '${d.name}', () => __invoke(${fn(d.name)}), (${NEXT_VALUE}) => { ${fn(d.name)} = ${NEXT_VALUE}; }, () => ${fn(d.name)}, true, true);`
        ),
        // A class is bound as in a component (`authorBindings`), so the
        // namespace sees its statement add the name, as `globals()` does.
        ...declaredClasses(c).flatMap((n, at) => [
            ...(at === 0 ? ['const __classes = __global.Object.create(null);'] : []),
            `__bind(__proto, '${n}', () => __pybridge.declared(__classes[${JSON.stringify(n)}]), function (${NEXT_VALUE}) { __pybridge.declare(this, '${n}', ${NEXT_VALUE}, __classes); });`
        ]),
        ...injections(c, false),

        // A module has no `<script module>`, so nothing joins its own imports.
        ...jsNameBindings(HOST, c),
        ``
    ];
}

// Replaced by a new one when its body raises (`moduleLoad`).
function plainInit(c) {
    return [...namespaceObject(HOST, { name: pythonModuleName(c.source), replaced: true }), ``];
}

// The functions a reactive module also exports by name. A function it names
// `store` is not one: that name is the module's `store` object, which reaches
// the function as `store.store`, and Python's importers as `module.store`.
const storeExports = (c) => c.funcs.filter((f) => c.published(f.name) && f.name !== 'store');

// What a module exports by name, filled as its body binds it: a `.py` hands
// JavaScript every name through the boundary, a `.svelte.py` its functions,
// the rest through `store`.
const liveExports = (c) =>
    c.store
        ? storeExports(c)
              .map(
                  (f) =>
                      `__liveExport(${NS}, ${JSON.stringify(f.name)}, (__value) => { __export_${f.name} = ` +
                      `${storeRead(c, f.name, '__value', wrapperName(f.name))}; });`
              )
        : liveExportLines(HOST, c);

// The function that runs a module's body (Bryc's `moduleLoad`): the body, the
// refusals that read what it bound, the exports it filled, and a store's
// effects. A `.remote.py` is eager, loaded by SvelteKit when it decides, as a
// route module is, and refused by it when it exports a default, and reached by
// JavaScript through the module that calls it (`svelthon.js`,
// `eagerModule`). A failed attempt's effect roots are that attempt's, so the
// next one makes its own.
function storeOrModuleLoad(c) {
    if (!c.store && !c.plain) return [];

    return moduleLoad(HOST, {
        name: pythonModuleName(c.source),
        eager: c.eager,
        run: [`__init(${NS});`, ...unboundRefusals(HOST, c.unbound, c.listedAt), ...starredMembers(c), ...liveExports(c), ...(c.store ? effectLines(c) : [])],
        renewed: c.effects.filter((e) => e.root).map((e) => `${destroyer(e.name)} = ${RUNTIME.laterRoot}();`)
    });
}

// SvelteKit reads a route module's names off it, and refuses a default export
// there: a `.py` exports by name only (Bryc's `moduleExports`), filled by the
// body as it binds them (`liveExports`, `moduleLoad`).
const plainExports = (c) => moduleExports(HOST, c);

// The order, which is the one thing about this file that cannot be read off any
// single section. Four constraints hold it, and `tests/sections.test.js` asserts
// all four on the emitted script rather than on this list, since a list can only
// restate itself:
//
//   1. the injections bind *after* the author's names, or they take them;
//   2. init() comes after every binding, since it is what fills them;
//   3. the exported wrappers come after init(), so they call something;
//   4. the effects come last, since an effect runs its body on creation.
//
// A module keeps the same order inside the function that runs its body when it
// is imported (`moduleLoad`), last, so that it finds every declaration.
//
// Nothing breaks if a section moves. Something subtle stops working.
const COMPONENT_SECTIONS = [
    preamble,
    declarations,
    templateBridge,
    authorBindings,
    componentNamespace,
    injectedBindings,
    initCall,
    instanceExports,
    effectBlocks,
    storeOrModuleLoad
];

const PLAIN_SECTIONS = [
    plainPreamble,
    plainDeclarations,
    plainBindings,
    plainInit,
    plainExports,
    storeOrModuleLoad
];

function compile(
    src,
    name = 'Component',
    source = name,
    {
        store = false,
        plain = false,
        defs = [],
        defLines = [],
        defColumns = [],
        jsNames = [],
        lineOffset = 0,
        sourceContent = null,
        // Whether the component is compiled as a custom element.
        element = false,
        // Whether a module's body runs as the module is evaluated, with no
        // function behind a default export: the one half of a `.remote.py`.
        eager = false,
        // Whether an imported name is one of the project's own `.py` files,
        // `'file'`, or names a directory of the project, `'package'`, asked by
        // whoever can read the file system. Without it the imports are not
        // checked.
        resolves = null
    } = {}
) {
    // A component has markup, so it has the dialect; a module is a module and
    // keeps parsing as Python. Read before py2js, since `importjs` is not Python
    // and Brython would rightly refuse it.
    const component = !store && !plain;

    refuseGeneratedSpelling(src, source, lineOffset);

    // The common half, Bryc's: a component's script joined with its template's
    // functions, a `.py` taken as it is, `importjs` lifted, Svelthon's signs
    // made Python (`HOST.rewrite`), the translation, and the imports the
    // runtime cannot satisfy refused. The name Python imports a module by; a
    // component is imported by nobody and keeps its path.
    //
    // In Svelthon's markup, and only there, the dot finds a key as well as an
    // attribute: the template's functions are written so before Bryc joins
    // them (`templateDots`), with the bridge's `readAttr` and `writeAttr`.
    const compiled = compileCommon(HOST, src, {
        name,
        source,
        component,
        named: component ? null : pythonModuleName(source),
        defs: defs.map((def) => templateDots(HOST, def)),
        defLines,
        defColumns,
        lineOffset,
        jsNames,
        resolves,
        sourceContent
    });
    const { root, table, js, namespace, module, map, jsImports, jsImported, imported, ranges: exprLines, templateLine } = compiled;

    ({ src } = compiled);

    if (component) refuseTemplateWalrus(root._ast, table, source, exprLines);

    let { props, bindables, defaulted, state, funcs, classes, deriveds, effects, inspects, reserved, bound, lines, remarked, starred } =
        surface(root._ast.body, new Set(jsImported));

    // A custom element's props belong to its element, which reads each back,
    // as `element.middle` and as the attribute `reflect` writes. Svelte answers
    // both from an accessor it publishes for a destructured prop, the one a
    // `bindable` is, so every prop takes that path; a scalar the component
    // writes reaches the element as JavaScript's own (`handOver`).
    if (element && !store && !plain) {
        bindables = [...props, ...bindables];
        props = [];
    }

    // Neither a store nor a plain module has a parent, so an annotation there
    // declares plain state, and $props() would be meaningless at module scope.
    if (store || plain) {
        state = [...props, ...bindables, ...state];
        props = [];
        bindables = [];

        // `$effect` needs a component to belong to, and neither has one. That is
        // exactly what `$effect.root` is for: it makes a scope of its own, which
        // is why `@effect.root` is the form a module writes. Anything else here
        // would be a function that looks reactive and is not, so it is refused
        // rather than quietly demoted, the same treatment `=>` gets in a `.py`.
        const orphan = effects.find((e) => !e.root);

        if (orphan) {
            const at = lines.get(orphan.name);
            const line = at === undefined ? undefined : at + lineOffset;

            throw refuse(
                `svelthon — \`@effect\` belongs to a component; ` +
                    `a ${plain ? '.py' : '.svelte.py'} module writes an effect with ` +
                    `\`@effect.root\`, whose name receives the destructor ` +
                    `(${line === undefined ? source : `${source}:${line}`})`,
                source,
                line
            );
        }

        // A plain module holds no signals at all, so an effect there would watch
        // nothing whatever it is spelled.
        if (plain && effects.length) {
            throw refuse(
                `svelthon — a plain .py module has no reactive state, so ` +
                    `\`@effect.root\` would watch nothing; move it to a .svelte.py (${source})`,
                source
            );
        }
    }

    // A plain module has no signals at all, so a @derived cannot be one either:
    // it becomes a function the accessor calls on every read. Same semantics,
    // read the name and get the result, minus the memoisation nothing observes.
    const plainDeriveds = plain ? deriveds : [];
    if (plain) deriveds = [];

    // Lifecycle by convention, mapped onto a single $effect: its body runs once
    // after the DOM exists, its teardown when the component goes away. Both
    // names stay ordinary functions, nothing stops Python calling them too.
    //
    // A hook is whatever the name holds once the script has run, however the
    // name was bound: a `def`, a value bound by `=`, `on_mount = lambda: …`, a
    // prop, a name imported from JavaScript by the script or by the `<script
    // module>`, where only the first two were asked and the others were never
    // called. Read off the `def`'s own binding, or off the name's, or, for a
    // name only a `from m import *` may bind, off the namespace, where it is
    // undefined when the star brought none.
    const defined = (hook) => funcs.some((f) => f.name === hook);
    const holdsHook = (hook) =>
        state.includes(hook) ||
        [...props, ...bindables].some((one) => (one.name ?? one) === hook) ||
        jsImported.includes(hook) ||
        jsNames.some((one) => pythonName(one) === hook);
    const lifecycle = (hook) => !store && (defined(hook) || holdsHook(hook) || starred);
    const hook = (name) => (defined(name) ? fn(name) : holdsHook(name) ? name : `${NS}.${name}`);

    // A component free to define its own `publish` or `derived` keeps it.
    // Two lists, and they answer two different questions.
    //
    // `emitted` is what the generated script declares in JavaScript, one binding
    // per reactive name. Anything that must not collide with a `let` or a `const`
    // reads this one.
    //
    // `declared` is every word the author took, however they wrote it. Whether a
    // helper may be injected over a name, and whether a locked word has been
    // redefined, are questions about the author's text and not about signals.
    const emitted = [
        ...props, ...bindables, ...state, ...funcs, ...deriveds, ...effects, ...inspects
    ].map((n) => n.name || n);

    const declared = [...new Set([...emitted, ...bound])];

    refuseLocked([...declared, ...reserved], !plain && !store, source, lines, lineOffset);
    refuseReserved(HOST, reserved, source, lines, lineOffset);
    refuseRemarked(remarked, source, lines, lineOffset);
    // What the author took, an `importjs {inspect}` among them, is no rune.
    const theirs = new Set([...declared, ...jsImported]);
    refuseNestedRunes(root._ast.body, source, lineOffset, theirs, table);
    refuseMisplacedMarkers(root._ast.body, source, lineOffset, theirs, component, table);

    // Functions by default, what a framework calls by name. A module that wants
    // to export values says so with `__all__`, exactly as it would to a Python
    // caller. SvelteKit is strict about it: a `+page.server.py` exporting
    // anything but load/actions/prerender/… is refused, and rightly so.
    const declaration = declaredExports(HOST, root._ast, table, source, lineOffset, src);
    const listed = declaration === null ? null : declaration.names;
    const exported = listed ?? funcs.map((f) => f.name);

    // What the list names that the module cannot export (Bryc's
    // `exportChecks`); with a `from m import *`, a name not yet bound waits
    // until the module has run.
    const binds = moduleBinds(table);
    const { unbound, line, listedAt } = exportChecks(HOST, { declaration, declared, binds, jsImported, starred, source });

    // A `@derived` of a plain module is a call made at every read, and an export
    // is a value JavaScript keeps: it would go on reading what the call gave at
    // import. Svelte refuses to export derived state from a module for that
    // reason, `derived_invalid_export`, and so does this, with its advice.
    const exportedDerived = (listed ?? []).find((n) => plainDeriveds.some((d) => d.name === n));

    if (exportedDerived !== undefined) {
        throw refuse(
            `svelthon — \`__all__\` names \`${exportedDerived}\`, a \`@derived\`, which a module ` +
                `cannot export: JavaScript would keep the value it had when it was read. To expose ` +
                `the current value, export a function returning it (${listedAt}).`,
            source,
            line
        );
    }

    const isFunction = (name) => funcs.some((f) => f.name === name);

    // What the store publishes and the compiler gave no signal: a class, the
    // destructor of an `@effect.root`, a name an import brought, one a star
    // import brought. A store reads it off the namespace, as a `.py` does. What
    // `__all__` lists, or, with none, every name the module binds: the store
    // publishes every name it has, and its directives are none of them.
    const unsignalled = (listed ?? (store ? [...new Set([...binds, ...jsImported])].filter((n) => !DIRECTIVES.has(n)) : [])).filter(
        (n) => !state.includes(n) && !deriveds.some((d) => d.name === n) && !isFunction(n)
    );

    // Everything the sections read, gathered once. Nothing is computed here:
    // the whole of `compile()` above this line is the reading, and everything
    // below it is the writing.
    const c = {
        name,
        source,
        lineOffset,
        // How a Python line becomes a file line, read by `pyError`: the offset
        // alone, or the offset with the template functions' ranges.
        lines: exprLines.length ? { offset: lineOffset, ranges: exprLines } : lineOffset,
        templateLine,
        store,
        plain,
        eager,
        namespace,
        js,
        // Every name the module reads as a global (`globalReads`). What decides
        // whether `host` and `props_id` are bound at all: each is bound only
        // where the name is actually read, `props_id` because its value must be
        // computed at the top level rather than lazily, `host` because Svelte
        // refuses `$host()` outright in a component that is not a custom
        // element. A name and not a text, which would match a Python string,
        // `role = "host"`, and emit `$host()` where Svelte refuses it.
        names: globalReads(table),
        declared,
        emitted,
        // Whether a name belongs to the module's public surface. `__all__` when
        // the module wrote one, everything when it did not.
        published: (name) => listed === null || listed.includes(name),
        listsAll: listed !== null,
        imported,
        props,
        bindables,
        defaulted,
        // A custom element publishes an accessor per name the props
        // destructure, so it reads no parent's value by a second one.
        element: element && !store && !plain,
        state,
        funcs,
        classes,
        deriveds,
        effects,
        inspects,
        starred,
        unbound: starred ? unbound : [],
        listedAt,
        unsignalled,
        plainDeriveds,
        jsImports,
        jsImported,
        jsNames,
        exported,
        isFunction,
        lifecycle,
        hook
    };

    const script = (plain ? PLAIN_SECTIONS : COMPONENT_SECTIONS)
        .flatMap((section) => section(c))
        .join('\n');

    return {
        script,
        module,
        map,
        imports: imported
    };
}

const VIRTUAL_PREFIX = 'virtual:svelthon/';

const virtualId = (name) => VIRTUAL_PREFIX + name;

// The type Svelte converts a custom element's attribute to, by the annotation
// that declares the prop: the annotation is the interface.
const ELEMENT_TYPES = {
    int: 'Number',
    float: 'Number',
    bool: 'Boolean',
    list: 'Array',
    tuple: 'Array',
    dict: 'Object',
    str: 'String'
};

// Every name an `importjs` binds, whatever it imports: a component tag under
// one of them is the import itself, whose language its file tells.
function importedNames(src, where) {
    try {
        return takeImportJs(HOST, src, where, 0, true).imports.flatMap((one) => one.entries.map((entry) => entry.local));
    } catch {
        return [];
    }
}

// The script alone, read before the compile by what has to know what it
// declares: parsed with its signs rewritten as the compile rewrites them, and
// the names JavaScript brings in (`theirs`), which `surface` sets apart. A
// script that does not parse gives null: the compile says why.
function readScript(src, where) {
    try {
        const lifted = takeImportJs(HOST, $B.unindent(src), where, 0, true);
        const theirs = new Set(lifted.imports.flatMap((one) => one.entries.map((e) => e.local)));
        const body = takeArrows(lifted.source, where, 0, true, theirs);
        const tree = $B._PyPegen.run_parser(new $B.Parser(body, where, 'file'));

        for (const one of declaredJsImports(HOST,tree, symbolTable(tree, where), where)) {
            for (const name of one.names) theirs.add(name);
        }

        return { tree, theirs };
    } catch {
        return null;
    }
}

// What the script declares, `surface`'s answer, which the compile acts on: its
// props, its deriveds and the rest. What the markup pass asks before it reads a
// name ahead of an expression. Null for a script that does not parse.
function scriptSurface(src) {
    const read = readScript(src, '<script>');

    return read === null ? null : surface(read.tree.body, read.theirs);
}

// The names of a script whose read runs code, off what it declares
// (`scriptSurface`): a derived, which runs its body when what it reads has
// changed, and a prop, bindable or not, which runs what the parent wrote for it.
const runningNames = ({ props, bindables, deriveds }) => [...props, ...bindables, ...deriveds.map((one) => one.name)];

// A component's props and the Svelte type of each, for a custom element: Svelte
// learns what to observe from a destructured `$props()`, which Svelthon does not
// write, or from `customElement.props`, which this fills. Read off the script
// alone (`readScript`). A script that does not parse declares nothing here.
function elementProps(src) {
    const read = readScript(src, '<props>');

    if (read === null) return [];

    const { tree, theirs } = read;

    // Which names are props is `surface`'s answer, the one the compile acts on;
    // what is read here is only the type each annotation names, anywhere a
    // prop can be declared.
    const types = new Map();
    const annotations = (statements) => {
        for (const node of statements) {
            if (node instanceof $B.ast.AnnAssign && node.target instanceof $B.ast.Name) {
                const annotation = node.annotation instanceof $B.ast.Subscript ? node.annotation.value : node.annotation;
                if (annotation instanceof $B.ast.Name) types.set(node.target.id, ELEMENT_TYPES[annotation.id]);
            }

            if (node instanceof $B.ast.FunctionDef || node instanceof $B.ast.AsyncFunctionDef || node instanceof $B.ast.ClassDef) {
                continue;
            }

            for (const key of BODIES) if (node[key]) annotations(node[key]);
        }
    };

    annotations(tree.body);

    const { props, bindables } = surface(tree.body, theirs);

    return [...props, ...bindables].map((name) => ({ name, type: types.get(name) }));
}

export {
    compile,
    VIRTUAL_PREFIX,
    virtualId,
    pythonModuleName,
    elementProps,
    scriptSurface,
    runningNames,
    PY_NAME,
    componentImports,
    importedNames
};
