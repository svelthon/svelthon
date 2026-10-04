'use strict';

// Build-time half of Svelthon: run Brython's compiler under Node and split the
// result in two: a plain ES module holding the generated code, and a Svelte
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
// and three more, and `boot.js` removes whatever it added by comparing against
// this set. Recorded too late, the stubs count as pre-existing and survive, and
// then every library that tests `typeof document` takes the browser path and
// dies on `window is not defined`.
globalThis.$B.$svelthonGlobalsBefore ??= new Set(Object.getOwnPropertyNames(globalThis));

// The engine, then the parsing chain: this file is the one that compiles, so it
// is the one that declares it needs a compiler. Everything else loads `boot.js`,
// which takes the engine alone, and a bundler puts the chain in the chunk of
// whatever imports *this*. A route that does not compile never receives it.
//
// Order is the contract: the chain registers `$B.Parser` onto an engine that is
// already there.
require('../../vendor/brython_runtime.js');
require('../../vendor/brython_compiler.js');

const $B = globalThis.__BRYTHON__;
$B.brython({ ipy_id: [] });

const { INJECTED } = require('./injected.cjs');
const { atomic } = require('./lexical.js');

// Name the generated module gives to the reactive namespace it receives.
const NS = '__py';

// Brython emits module state into a namespace object:
//     locals_Counter = $B.namespace('Counter')
//     locals_Counter.count = 0
// Nothing lives in a lexical binding, so there is a single call to intercept,
// which the runtime does at execution time. This pattern is only checked, never
// rewritten; if a future codegen stops emitting it, compilation fails loudly
// instead of producing a component with no reactivity at all.
// The literal is Brython's own spelling, since this is both what is written
// beside its code and the needle the check below looks for in it. A path may
// hold a quote — `src/O'Brien.svelte` is a legal filename — so it is escaped
// rather than pasted, on both sides of the bridge: unescaped, the generated
// module stopped parsing, and the Python it came from was perfectly valid.
const namespaceCall = (name) => `$B.namespace(${JSON.stringify(name)})`;

// The module id Brython derives from a filename: only '.' becomes '_'. It ends
// up as a *string*, the argument to $B.namespace and the frame name, so a '/'
// is harmless there. The identifier built beside it is a different matter, and
// the vendored build is patched so that one stays valid (see BRYTHON.md).
const namespaceFor = (filename) => filename.replace(/\./g, '_');

// A Brython exception carries neither `message` nor `stack`, so a Python syntax
// error would reach Vite as an empty object and be reported as nothing at all.
// `$B.unindent` hands the source back untouched as soon as one non-blank line
// already sits at column zero: it reads that as an author who meant it. In a
// `.svelte` the block is indented one level by convention, so such a line is
// almost always one typed without the others' indentation, and nothing is
// dedented, so Brython raises on the *first* line instead, which the author did
// not touch.
//
// Refusing is right: a line out of line with its neighbours is a mistake, and
// compiling it anyway would accept in silence what the rest of the project
// rejects out loud. What was missing is only the sentence saying so. Returns the
// line to blame, or 0 when there is nothing to say.
function flushLine(src) {
    const lines = src.split('\n');
    if (!lines.some((line) => /^[ \t]+\S/.test(line))) return 0;

    return lines.findIndex((line) => /^\S/.test(line)) + 1;
}

// A refusal, in Svelte's own error shape, which is what makes it clickable.
//
// `vite-plugin-svelte` builds `rollupError.loc` only `if (error.start)`, and
// `loc` is what the dev overlay highlights and what an editor jumps to. Without
// it, a mistake in the markup got a squiggle and a mistake in the script got a
// line of console text, out of the same compiler.
//
// The position stays in the message as well, and that is not a duplicate: the
// fields are what the plugin reads, the sentence is what anyone else reads, the
// playground compiling in a browser included.
//
// There is no column. These refusals know which line they were reading and not
// where in it; `markup.js` has one because it scans character by character.
function positioned(error, source, line, column = 0) {
    error.filename = source;

    if (typeof line === 'number') {
        error.start = { line, column };
        error.end = { line, column };
    }

    return error;
}

const refuse = (message, source, line, column) =>
    positioned(new SyntaxError(message), source, line, column);

// JavaScript an author coming from Svelte writes in a template that reads
// Python, and what Python writes instead. Read on the expression with its
// strings taken out, so a `?` or a `!` inside a string says nothing.
const HABITS = [
    [/\?[^:]*:/, '`a ? b : c` is `b if a else c`'],
    [/&&|\|\|/, '`&&` and `||` are `and` and `or`'],
    [/[!=]==/, '`===` and `!==` are `==` and `!=`'],
    // Not `!r`, `!s`, `!a`: a conversion, which belongs in an f-string field.
    [/(^|[^!=<>])!(?![=rsa]\b)/, '`!x` is `not x`'],
    [/`/, 'a template literal is an f-string, `f"n={x}"`'],
    [/=>/, 'an arrow function is a `lambda`: `lambda: (count := count + 1)`'],
    [/\+\+|--/, '`x++` is `(x := x + 1)`'],
    [/\?\?/, '`a ?? b` is `a if a is not None else b`'],
    [/\b(?:null|undefined|true|false)\b/, '`null`, `true`, `false` are `None`, `True`, `False`'],
    [/\.push\(/, '`.push(x)` is `.append(x)`'],
    [/\.length\b/, '`.length` is `len(…)`']
];

const habitsIn = (text) => {
    // Across lines too, so a triple-quoted string is text as a whole.
    const code = text.replace(/(["'])(?:\\[\s\S]|(?!\1)[\s\S])*\1/g, '""');
    return HABITS.filter(([pattern]) => pattern.test(code)).map(([, said]) => said);
};

// `lineOffset` is the count of lines before the script, and `ranges` the Python
// lines each template function occupies with the markup line it stands for: the
// table the runtime reads for an error raised later, read here for one raised
// at compile time. A syntax error in `{ok ? "yes" : "no"}` names the line of
// markup it is written on, quotes it, and says what Python writes instead.
function pythonError(error, source, lineOffset, block = '', ranges = [], src = '') {
    // A JavaScript Error is not ours to describe: it already carries a message
    // and a stack, and wrapping it produced the useless
    // `JSObject: <Javascript object: [object Error]>`, which hid what actually
    // went wrong behind our own formatting.
    if (error instanceof Error) return error;

    let described = 'PythonError';
    let where = source;
    let at;
    let column;

    try {
        const name = $B.$getattr($B.get_class(error), '__name__');
        described = `${name}: ${$B.builtins.str.$factory(error)}`;
    } catch {
        /* not a Brython exception: keep the generic label */
    }

    let quoted = '';

    try {
        const line = $B.$getattr(error, 'lineno');
        if (typeof line === 'number') {
            const range = ranges.find(([from, to]) => line >= from && line <= to);
            at = range === undefined ? line + lineOffset : range[2];
            // The column of the expression itself when it is one of the
            // template's, in the `file:line:column` its refusals use.
            column = range === undefined ? undefined : range[3];
            where = column === undefined ? `${source}:${at}` : `${source}:${at}:${column + 1}`;

            if (range !== undefined) {
                // The author's text, out of the wrapper the markup pass put
                // around it: `__text(…)`, `__truthy(…)`.
                const written = src
                    .split('\n')
                    .slice(range[0], range[1])
                    .join(' ')
                    .trim()
                    .replace(/^return\s+/, '')
                    .replace(/^__\w+\(([\s\S]*)\)$/, '$1');
                const said = habitsIn(written);
                quoted =
                    `\n  in the template expression \`${written}\`,` +
                    ` which is Python` +
                    (said.length ? `: ${said.join('; ')}.` : '.');
            }
        }
    } catch {
        /* no position on it */
    }

    const flush = described.startsWith('IndentationError') ? flushLine(block) : 0;

    return refuse(
        `svelthon — ${described} (${where})` +
            quoted +
            (flush
                ? `\n  line ${flush + lineOffset} starts at column zero while the rest of` +
                  ` the block is indented, so indent it like its neighbours.`
                : ''),
        source,
        at,
        column
    );
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

// `__all__ = ["load"]`, Python's own way of saying what a module exports, and
// the closest thing it has to TypeScript's `export` keyword. Read from the AST,
// so it stays a plain assignment in the source.
//
// **Every statement, in order, and the value that counts is the last one.**
// This read the *first* assignment and stopped, so a module that narrowed its
// list afterwards — a second `__all__ = [...]`, or the `+=` that a conditional
// export is written with — exported the list it no longer had. `__all__` is an
// ordinary Python name and the value it holds when the module has finished
// running is the one `from m import *` obeys.
//
// What literals spell, Python computes the same on every run, so each such
// statement is run, by Python, rather than read by a copy of its rules: a copy
// was written once per method and was wrong where it stopped, `+= "bc"`
// refused and `.append()` on a tuple accepted. Anything else is refused rather
// than skipped, and that is the half the silence was hiding: a declaration
// that matched nothing was dropped and the module fell back to **exporting
// everything** — a file that states a contract and publishes past it, with
// nothing said.
//
// An entry that is not a string, which CPython itself raises on at
// `from m import *`, has long been left out while the good ones are kept, and
// that decision stands.
//
// `__js__` keeps the literal reading below: it is a directive of this project,
// set by one assignment and changed by nothing else. **Unreadable** is an
// element its source does not spell.
const UNREADABLE = Symbol('unreadable');

const NAMES = (node) =>
    node instanceof $B.ast.List || node instanceof $B.ast.Tuple
        ? node.elts.map((one) => (one instanceof $B.ast.Constant ? one.value : UNREADABLE))
        : null;

const readable = (given) => given !== null && !given.includes(UNREADABLE);
const strings = (given) => given.filter((one) => typeof one === 'string');

const isAll = (node) => node instanceof $B.ast.Name && node.id === '__all__';

// Methods of a list that read it and change nothing.
const READS_LIST = new Set(['copy', 'count', 'index', '__len__', '__contains__', '__iter__', '__getitem__']);

// Whether a target writes `__all__`: the name, an item or a slice of it, or
// either inside a tuple or a starred target.
const targetsAll = (target) =>
    isAll(target) ||
    (target instanceof $B.ast.Subscript && isAll(target.value)) ||
    (target instanceof $B.ast.Starred && targetsAll(target.value)) ||
    ((target instanceof $B.ast.Tuple || target instanceof $B.ast.List) && target.elts.some(targetsAll));

// Whether a node, of any shape, writes `__all__`: a method that changes it,
// an assignment, a deletion, a loop or `with` target, a walrus, an import alias,
// an `except … as` or a `match` capture. A read, `return __all__`, is not one.
const writesAll = (node) => {
    if (node instanceof $B.ast.Call) {
        const to = node.func;
        return to instanceof $B.ast.Attribute && isAll(to.value) && !READS_LIST.has(to.attr);
    }
    if (node instanceof $B.ast.Assign || node instanceof $B.ast.Delete) return node.targets.some(targetsAll);
    if (node instanceof $B.ast.AugAssign) return targetsAll(node.target);
    if (node instanceof $B.ast.AnnAssign) return Boolean(node.value) && targetsAll(node.target);
    if (node instanceof $B.ast.For || node instanceof $B.ast.AsyncFor) return targetsAll(node.target);
    if (node instanceof $B.ast.withitem) return Boolean(node.optional_vars) && targetsAll(node.optional_vars);
    if (node instanceof $B.ast.NamedExpr) return isAll(node.target);
    if (node instanceof $B.ast.alias) return (node.asname ?? node.name) === '__all__';
    if (node instanceof $B.ast.ExceptHandler) return node.name === '__all__';
    if (node instanceof $B.ast.MatchAs || node instanceof $B.ast.MatchStar) return node.name === '__all__';
    if (node instanceof $B.ast.MatchMapping) return node.rest === '__all__';
    return false;
};

const COMPREHENSIONS = ['ListComp', 'SetComp', 'DictComp', 'GeneratorExp'];

// The builtins that read a list and keep nothing of it: given `__all__`, they
// cannot change it behind the compiler's back.
const READS_ONLY = new Set([
    'len', 'list', 'tuple', 'sorted', 'set', 'frozenset', 'iter', 'enumerate', 'reversed',
    'str', 'repr', 'print', 'any', 'all', 'min', 'max', 'sum', 'zip'
]);

// Whether a read of `__all__` keeps the list where the compiler sees it. Handed
// on, `names = __all__` or `list.clear(__all__)`, it can be changed by what no
// static reading follows.
// `builtin(name)` says whether the name is the builtin there, and not a
// function of the author's that took its name.
const keepsAll = (parent, grand, node, builtin) =>
    (parent instanceof $B.ast.Attribute && grand instanceof $B.ast.Call && grand.func === parent) ||
    (parent instanceof $B.ast.Subscript && parent.value === node) ||
    parent instanceof $B.ast.Compare ||
    parent instanceof $B.ast.BinOp ||
    parent instanceof $B.ast.Starred ||
    parent instanceof $B.ast.FormattedValue ||
    parent instanceof $B.ast.Expr ||
    ((parent instanceof $B.ast.For || parent instanceof $B.ast.AsyncFor || parent instanceof $B.ast.comprehension) &&
        parent.iter === node) ||
    (COMPREHENSIONS.some((one) => parent instanceof $B.ast[one]) && parent.generators[0].iter === node) ||
    (parent instanceof $B.ast.Call &&
        parent.func instanceof $B.ast.Name &&
        READS_ONLY.has(parent.func.id) &&
        builtin(parent.func.id) &&
        parent.args.includes(node));

// Every place the source writes `__all__`, with the line of the statement it
// is in and the scope its value is evaluated in: a `def`, a `class`, a lambda
// or a comprehension, or null for the module. What Python evaluates where the
// definition stands, a default, a decorator, an annotation, a base, a
// comprehension's first iterable, belongs to the enclosing scope, as it does
// in Python.
//
// And every read that hands the list on, `escapes`, where what is done to it
// next is out of sight.
function allWrites(ast, builtin = () => false) {
    const found = [];
    const seen = new Set();
    const is = (node, ...names) => names.some((one) => node instanceof $B.ast[one]);
    // The node being visited and its parent, so a read knows where it stands.
    let parent = null;
    let grand = null;

    const visit = (node, scope, line) => {
        if (node === null || typeof node !== 'object' || seen.has(node)) return;
        if (Array.isArray(node)) {
            for (const one of node) visit(one, scope, line);
            return;
        }
        seen.add(node);

        const at = typeof node.lineno === 'number' ? node.lineno : line;
        if (writesAll(node)) found.push({ node, scope, line: at });
        if (
            isAll(node) &&
            node.ctx instanceof $B.ast.Load &&
            !keepsAll(parent, grand, node, (name) => builtin(name, scope))
        ) {
            found.push({ node, scope, line: at, escapes: true });
        }

        const [outer, outerGrand] = [parent, grand];
        [parent, grand] = [node, parent];
        try {
            visitInside(node, scope, at);
        } finally {
            [parent, grand] = [outer, outerGrand];
        }
    };

    const visitInside = (node, scope, at) => {
        if (is(node, 'FunctionDef', 'AsyncFunctionDef', 'Lambda')) {
            const args = node.args ?? {};
            const params = [...(args.posonlyargs ?? []), ...(args.args ?? []), ...(args.kwonlyargs ?? [])];
            visit(node.decorator_list, scope, at);
            visit(args.defaults, scope, at);
            visit(args.kw_defaults, scope, at);
            visit(node.returns, scope, at);
            for (const one of [...params, args.vararg, args.kwarg]) visit(one?.annotation, scope, at);
            visit(node.body, node, at);
            return;
        }

        if (is(node, 'ClassDef')) {
            visit(node.decorator_list, scope, at);
            visit(node.bases, scope, at);
            visit(node.keywords, scope, at);
            visit(node.body, node, at);
            return;
        }

        if (is(node, ...COMPREHENSIONS)) {
            const [first, ...rest] = node.generators;
            visit(first.iter, scope, at);
            visit([first.target, first.ifs, rest, node.elt, node.key, node.value], node, at);
            return;
        }

        for (const [key, value] of Object.entries(node)) if (key !== 'parent') visit(value, scope, at);
    };

    visit(ast.body, null, undefined);
    return found;
}

// Python's symbol table for a module, built once per compile: the module's
// block, and every block by the AST node it stands for, which Brython marks
// with `$B.ID` as it builds the table.
function symbolTable(ast, source) {
    const top = $B._PySymtable_Build(ast, source, $B.future_features(ast, source));
    const byNode = new Map();

    const index = (block) => {
        byNode.set(block.id, block);
        block.children.forEach(index);
    };
    index(top);

    return { top, blockOf: (node) => byNode.get(node[$B.ID]) };
}

// Where a name resolves in a block: its scope, `GLOBAL_EXPLICIT` and
// `GLOBAL_IMPLICIT` meaning the module's.
const scopeIn = (block, name) =>
    ($B.str_dict_get(block.symbols, name, 0) >> $B.SYMBOL_FLAGS.SCOPE_OFFSET) & $B.SYMBOL_FLAGS.SCOPE_MASK;

const isGlobalScope = (scope) =>
    scope === $B.SYMBOL_FLAGS.GLOBAL_EXPLICIT || scope === $B.SYMBOL_FLAGS.GLOBAL_IMPLICIT;

// The names the module itself binds, whatever binds them: an assignment, an
// import, a `def`, a walrus in a default, a `match` capture. Python's answer,
// read off the module's block.
const moduleBinds = (table) => {
    const bound = new Set();
    for (const { key, value } of $B.builtins.dict.$iter_items(table.top.symbols)) {
        if (value & $B.SYMBOL_FLAGS.DEF_BOUND) bound.add(key);
    }
    return bound;
};

// The builtins a statement of `__all__` may call: each reads what it is given
// and keeps nothing, so the call answers the same on every run.
const PURE_BUILTINS = new Set([...READS_ONLY].filter((name) => name !== 'print'));

// What a statement cannot be written with and still give one answer before the
// module runs: a function of its own, a walrus, a comprehension's names, a
// suspension.
const UNSPELLED = ['Lambda', 'NamedExpr', 'ListComp', 'SetComp', 'DictComp', 'GeneratorExp', 'Await', 'Yield', 'YieldFrom'];

// What in a statement keeps its result from being known before the module runs:
// a name read that is neither `__all__` nor a builtin above, or a construct of
// `UNSPELLED`. Null when it is written with literals alone, and Python's
// answer is then the only answer. A name it binds, `x = __all__.pop()`, binds
// it and changes nothing about the list.
function unspelled(node, pure) {
    if (node instanceof $B.ast.Name) {
        const read = !(node.ctx instanceof $B.ast.Store);
        return read && node.id !== '__all__' && !pure(node.id) ? `computed from \`${node.id}\`` : null;
    }
    const kind = UNSPELLED.find((one) => node instanceof $B.ast[one]);
    if (kind !== undefined) return `written with a ${kind}`;
    for (const child of children(node)) {
        const found = unspelled(child, pure);
        if (found !== null) return found;
    }
    return null;
}

// What a node holds, by the fields its class declares, as CPython's `ast` walks
// it. Not its own keys: a node also carries `$parent`, and the walk would climb
// back to the module.
const children = (node) =>
    (node?.constructor?._fields ?? []).flatMap((field) => {
        const value = node[field];
        if (Array.isArray(value)) return value.filter((one) => one !== null && typeof one === 'object');
        return value !== null && typeof value === 'object' ? [value] : [];
    });

// Whether a node writes `__all__` anywhere inside it.
const hasWrite = (node) => writesAll(node) || children(node).some(hasWrite);

// Every node a statement holds, so the walk of every write below knows the
// statement was followed.
const nodesOf = (node, into) => {
    into.add(node);
    for (const child of children(node)) nodesOf(child, into);
    return into;
};

// Runs statements as Python runs them, one by one in a namespace of their own,
// and hands back that namespace, or the statement Python raised at with what it
// raised. Each statement is taken from a parse of its own of the same source:
// the module's tree carries the marks its symbol table reads, and a second table
// over it would overwrite them.
//
// Brython's counter is given back afterwards, as `compile()` gives it back
// around its own run, so that what this runs changes nothing in the code
// generated next. Its tag is not touched: it names lambdas, and a statement of
// `__all__` holds none.
//
// A statement is found in that parse by where it stands, never by its index:
// Brython's code generator takes a module's docstring out of the body it
// compiled, and the two bodies then count differently.
function runStatements(src, statements) {
    const name = '__svelthon_all__';
    const tree = $B._PyPegen.run_parser(new $B.Parser(src, name, 'file'));
    const at = (node) => `${node.lineno}:${node.col_offset}`;
    const parsed = new Map(tree.body.map((node) => [at(node), node]));
    const namespace = {};
    const original = $B.namespace;
    const counter = $B.id_counter(counterStart(name));

    $B.namespace = (requested) => (requested === name ? namespace : original(requested));
    try {
        for (const statement of statements) {
            const module = new $B.ast.Module([parsed.get(at(statement))], []);
            const symtable = $B._PySymtable_Build(module, name, $B.future_features(module, name));

            try {
                (0, eval)($B.js_from_root({ ast: module, symtable, filename: name, src }).js);
            } catch (error) {
                const raised = error?.ob_type ? `${$B.class_name(error)}: ${$B.builtins.str.$factory(error)}` : String(error);

                return { namespace, statement, raised };
            }
        }
    } finally {
        $B.namespace = original;
        $B.id_counter(counter);
    }

    return { namespace };
}

// What comes back is the list and the line of the statement that last set it,
// which is where a refusal about the list points.
//
// Each statement of the module's own that writes `__all__` is run as Python runs
// it, when it is written with literals, `__all__` and the builtins above, since
// Python's answer is then the only one: `+= "bc"` adds `b` and `c`, `.append()`
// on a tuple raises. A write this cannot run, anywhere it resolves to the
// module's `__all__`, is refused.
function declaredExports(ast, table, source, lineOffset = 0, src = '') {
    const body = ast.body;
    const handled = new Set();
    let names = null;
    let line;

    const refuseUnreadable = (node, what) => {
        throw refuse(
            `svelthon — \`__all__\` is ${what}, and the export list is read from the source ` +
                `before the module runs: a statement at the top level of the module written ` +
                `with literals, \`__all__\` itself and the builtins is run as Python runs it, ` +
                `and nothing else can be followed. Write the names, or drop \`__all__\` and let ` +
                `the module export its functions.`,
            source,
            node.lineno === undefined ? undefined : node.lineno + lineOffset
        );
    };

    // A name is the builtin at the top of the module where the module binds
    // nothing of that name.
    const bound = moduleBinds(table);

    // The module's own statements that write `__all__`, in order: a compound
    // one, a condition, a loop, a function, is left to the walk below.
    const simple = ['Assign', 'AugAssign', 'AnnAssign', 'Delete', 'Expr'];
    const run = [];

    for (const node of body) {
        if (!simple.some((kind) => node instanceof $B.ast[kind]) || !hasWrite(node)) continue;

        const why = unspelled(node, (name) => PURE_BUILTINS.has(name) && !bound.has(name));
        if (why !== null) refuseUnreadable(node, why);

        nodesOf(node, handled);
        run.push(node);
    }

    if (run.length) {
        const { namespace, statement, raised } = runStatements(src, run);

        // Python raises there, at import: the module never runs past it.
        if (raised !== undefined) {
            const at = statement.lineno + lineOffset;

            throw refuse(
                `svelthon — Python raises \`${raised}\` here when the module is imported, so ` +
                    `\`__all__\` has no value to export (${source}:${at})`,
                source,
                at
            );
        }

        // A list or a tuple is the export list, and an entry that is not a
        // string is left out, as a bad entry always was. Anything else, a
        // string or `None`, or no `__all__` at all once `del` has run, is no
        // export list, and the module exports its functions.
        const value = namespace.__all__;

        // A name holding a character past U+FFFF, `𠀀`, is a `String` object
        // here, the storage `pyScalar` reads in the runtime.
        if (value !== undefined && ($B.is_list(value) || $B.is_tuple(value))) {
            names = [...value]
                .map((one) => (one instanceof String ? one.valueOf() : one))
                .filter((one) => typeof one === 'string');
        }
        line = run.at(-1).lineno + lineOffset;
    }

    // Every other write that reaches the module's `__all__`: under a condition,
    // in a loop, in a function or a class that does not make the name its own,
    // or rebound by a loop, an import or a walrus.
    // A name is the builtin where no scope binds it: not the function's own, not
    // the module's.
    const builtin = (name, scope) => {
        const block = scope === null ? null : table.blockOf(scope);
        if (block !== null && block !== undefined && !isGlobalScope(scopeIn(block, name))) return false;
        return !bound.has(name);
    };

    for (const { node, scope, line: at, escapes } of allWrites(ast, builtin)) {
        if (handled.has(node)) continue;

        const block = scope === null ? null : table.blockOf(scope);
        if (block !== null && block !== undefined && !isGlobalScope(scopeIn(block, '__all__'))) continue;

        // A read that hands the list on matters only for a module that has one.
        if (escapes && names === null) continue;

        refuseUnreadable(
            { lineno: at },
            escapes
                ? 'handed on where this file cannot follow what is done to it; `list(__all__)` is a copy'
                : 'changed where this file cannot follow it'
        );
    }

    // A name listed twice is exported once: Python allows the repetition, and
    // JavaScript refuses a duplicate export.
    return names === null ? null : { names: [...new Set(names)], line };
}

// `__js__ = {"@sveltejs/kit": ["error", "redirect"]}`: the JavaScript a module
// needs. Python has no way to import from npm, and a plain `.py` has no
// `<script module>` to do it for them; this is its equivalent, written as an
// ordinary assignment and read from the AST like `__all__`, under the same two
// rules: the value that counts is the last one assigned, and what a static read
// cannot follow is refused rather than skipped.
function declaredJsImports(body, source, lineOffset = 0) {
    let modules = [];

    const refuseAt = (node, what) => {
        const line = node.lineno + lineOffset;

        throw refuse(`svelthon — \`__js__\` ${what} (${source}:${line})`, source, line);
    };

    // Any other write reaches the dict after the read: `__js__["m"] = […]`,
    // `__js__ |= {…}`, `__js__.update(…)`, anywhere in the module.
    const isJs = (node) => node instanceof $B.ast.Name && node.id === '__js__';
    const met = new WeakSet();
    const writes = (node) => {
        if (!node || typeof node !== 'object' || met.has(node)) return;
        met.add(node);
        if (Array.isArray(node)) return node.forEach(writes);

        const changed =
            ((node instanceof $B.ast.AugAssign || node instanceof $B.ast.AnnAssign) && isJs(node.target)) ||
            (node instanceof $B.ast.Subscript && isJs(node.value) && !(node.ctx instanceof $B.ast.Load)) ||
            (node instanceof $B.ast.Call && node.func instanceof $B.ast.Attribute && isJs(node.func.value));

        if (changed) refuseAt(node, 'is set by assigning it, and changed by nothing else');

        for (const key of Object.keys(node)) if (key !== 'parent') writes(node[key]);
    };

    writes(body);

    for (const node of body) {
        if (!(node instanceof $B.ast.Assign)) continue;
        if (!node.targets.some((t) => t instanceof $B.ast.Name && t.id === '__js__')) continue;

        if (!(node.value instanceof $B.ast.Dict)) {
            refuseAt(node, 'has to be written out as a dict of module names to lists of names');
        }

        modules = node.value.keys.map((key, index) => {
            const names = NAMES(node.value.values[index]);

            if (!(key instanceof $B.ast.Constant) || typeof key.value !== 'string' || !readable(names)) {
                refuseAt(node, 'has to be written out: each key a module name, each value a list of strings');
            }

            // The same question `importjs` asks, with the same answer.
            for (const one of strings(names)) {
                const why = unbindable(one);

                if (why !== null) refuseAt(node, `names \`${one}\`, ${why}`);
            }

            return { from: key.value, names: strings(names) };
        });
    }

    return modules.filter((one) => one.names.length);
}

// `importjs`: a component's JavaScript imports, written where its Python is.
//
// `__js__` covers a plain `.py`, and only the named form, which is all a module
// ever asks for: `error`, `redirect`, `query`, `browser`. A component asks for
// three more, and every one of them is a template concern: the default export,
// which is how a `.svelte` child is imported and by far the commonest (25 of the
// 65 imports measured across the three projects); a stylesheet, imported for its
// effect; and a namespace, which is what `<Dialog.Root>` needs. None of the three
// can occur in a module with no markup, which is why the dialect stops at the
// component and a `.py` keeps parsing as Python.
//
// A keyword rather than another declaration read from the AST. `__all__` is real
// Python and the compiler only reads it; `__js__` wears the same costume without
// the language behind it, and a dict literal invites being computed, which
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
// Two questions, and one pattern used to answer both. `JS_NAME` is what an
// `importjs` clause may contain, and ASCII is a defensible line there even
// though JavaScript takes `let élève = 1`: the name is one the author copies out
// of a JavaScript package.
//
// `PY_NAME` is the other question, and it has Python's answer: what a `.py`
// exports, whether through `__all__` or by default. Asked with the JavaScript
// pattern, `__all__ = ["élèves"]` was filtered to nothing and the module
// exported nothing at all, in silence. Same class as `markup.js`'s `NAME`, and
// for the same reason.
//
// Python's own classes, `XID_Start` and `XID_Continue`, which `str.isidentifier`
// answers by: letters alone left out `℘`, `℮` and `ᢅ` at the start and `·` after
// it, and a `def ℘()` was dropped from the exports with nothing said.
const JS_NAME = /^[A-Za-z_$][\w$]*$/;
const PY_NAME = /^[\p{XID_Start}_]\p{XID_Continue}*$/u;

// Why the local name of a JavaScript import cannot be bound, or null. It is a
// binding of the generated module, so it answers to the two rules every name
// there does, `refuseReserved` and `refuseLocked`: `new` and `default` stopped
// the module parsing, `__py` declared a name the compiler had declared already,
// and both were said by the JavaScript parser downstream rather than at the
// line that wrote them.
function unbindable(name) {
    if (!JS_NAME.test(name)) return 'which is not a name';
    if (JS_RESERVED.has(name)) return 'which JavaScript reserves, so the generated module cannot bind it';
    if (COMPILER_PREFIX.test(name)) return "which starts with `__`, the compiler's own prefix";

    return null;
}

// For each line of `src`, whether it begins inside a string an earlier line
// opened. Only a triple-quoted string survives a line break, so it is the only
// thing that can hide an `importjs` or a sign further down, the trap a regex
// over the whole source would walk straight into. Read over the whole source at
// once, by `atomic`: an f-string's fields may hold quotes of their own, and no
// line can then be read alone.
function continuedLines(src) {
    const inside = [false];

    for (let i = 0; i < src.length; i++) {
        const skip = atomic(src, i);

        if (skip > 0) {
            for (let j = i; j < i + skip; j++) if (src[j] === '\n') inside.push(true);
            i += skip - 1;
        } else if (src[i] === '\n') inside.push(false);
    }

    return inside;
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
// `=>` is a SyntaxError in Python, measured, so no valid source can contain one
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
// The dialect's signs each take the rest of the line — `(\S[\s\S]*)$` — and the
// rewrite wraps what they took in parentheses, so a `#` commented out the
// closing one and the author was told `'(' was never closed` about a parenthesis
// they never typed. Everything Python's own syntax carries accepts a trailing
// comment; every sign of ours refused one. The READMEs teach the refused form in
// three places each, which is how it was found.
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

// The first argument of a call's text and the rest, where Python's parser ends
// the first argument: a comma does not say it, since `lambda kind, *values: …`
// holds one between its parameters and a string or an f-string's field may
// hold one too. A text that does not parse is handed back whole, and the
// module's own parse then says what is wrong with it, at its line.
function firstArgument(text) {
    let first;

    try {
        first = $B._PyPegen.run_parser(new $B.Parser(`f(${text})`, '<arguments>', 'file')).body[0].value.args[0];
    } catch {
        return [text.trim(), ''];
    }

    // The columns are counted in characters on the one line, past `f(`.
    const end = first.end_col_offset - 2;

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
// next line a continuation rather than a statement.
function opened(expr) {
    let depth = 0;

    for (let i = 0; i < expr.length; i++) {
        const skip = atomic(expr, i);

        if (skip > 0) {
            i += skip - 1;
            continue;
        }

        const c = expr[i];

        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
    }

    return depth;
}
const ARROW_INDENTED = /^[ \t]+(?:[\p{XID_Start}_]\p{XID_Continue}*\s*)?=>\s/u;

function takeArrows(src, where, lineOffset, allowed) {
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
        // nothing about what to do. This says it.
        if (found && !balanced(expression)) {
            throw refuse(
                `svelthon — a ${kind(named)} written with \`=>\` must fit on one line; ` +
                    `use @${kind(named)} on a def for anything longer (${at})`,
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
        // lambda so that they are read again on every change.
        const watched = statement && !found && allowed ? text.match(INSPECT) : null;

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

        if (!found && !watched && !both) out.push(line);
        else if (watched && watched[1]) {
            // `inspect_with(logger, *values)`: two roles Svelte evaluates apart,
            // the values when it inspects and the logger when it logs. So two
            // lambdas, handed over as a pair that costs nothing to build.
            const [logger, values] = firstArgument(watched[2]);
            out.push(
                `__inspect_${anonymous++} = inspect_with(lambda: (lambda: [${values}], lambda: ${logger}))`
            );
        } else if (watched)
            out.push(`__inspect_${anonymous++} = inspect(lambda: [${watched[2]}])`);
        else if (both) out.push(`${both[1]} = bindable(${both[2] || ''})`);
        else if (named) out.push(`${found[1]} = derived(lambda: ${expression})`);
        // The generated name is bound like any other effect's, so it stays out
        // of the way with the dunder prefix Python already reads as private.
        else out.push(`__effect_${anonymous++} = effect(lambda: ${expression})`);
    }

    return out.join('\n');
}

// `where` is the sentence's `file:line`; `source` and `lineno` are the same two
// facts as fields, which is what an editor reads.
function importJsClause(line, where, source, lineno) {
    const bare = line.match(IMPORTJS_EFFECT);
    if (bare) return { from: bare[2], kind: 'effect', entries: [] };

    const found = line.match(IMPORTJS_CLAUSE);
    if (!found) {
        throw refuse(
            `svelthon — importjs expects \`importjs <clause> from "module"\` or ` +
                `\`importjs "module"\`, on one line (${where})`,
            source,
            lineno
        );
    }

    const clause = found[1].trim();
    const from = found[3];

    // Every name the clause binds, whatever its shape: `__js__` asks the same.
    // The name it imports may be any word, `{default as player}`; the one it
    // binds may not.
    const bound = (declared) => {
        for (const { local } of declared.entries) {
            const why = unbindable(local);

            if (why !== null) throw refuse(`svelthon — importjs: \`${local}\` ${why} (${where})`, source, lineno);
        }

        return declared;
    };

    const star = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (star) return bound({ from, kind: 'namespace', entries: [{ name: null, local: star[1] }] });

    // `{a, b as c}`: the names between the braces, each optionally renamed.
    const namedEntries = (inner) => {
        const entries = inner
            .split(',')
            .map((one) => one.trim())
            .filter(Boolean)
            .map((one) => {
                const renamed = one.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
                if (renamed) return { name: renamed[1], local: renamed[2] };
                if (JS_NAME.test(one)) return { name: one, local: one };

                throw refuse(
                    `svelthon — importjs: \`${one}\` is not a name (${where})`,
                    source,
                    lineno
                );
            });

        if (!entries.length) {
            throw refuse(`svelthon — importjs: empty {} (${where})`, source, lineno);
        }
        return entries;
    };

    const braced = clause.match(/^\{([\s\S]*)\}$/);
    if (braced) return bound({ from, kind: 'named', entries: namedEntries(braced[1]) });

    // `Player, {stopAll}`: the default and some names, from the same module.
    // JavaScript's own clause allows it, and a component that imports both a
    // component and something from its `<script module>` needs exactly this.
    // The default comes first in `entries`, marked by a null `name`.
    const mixed = clause.match(/^([A-Za-z_$][\w$]*)\s*,\s*\{([\s\S]*)\}$/);
    if (mixed) {
        return bound({
            from,
            kind: 'mixed',
            entries: [{ name: null, local: mixed[1] }, ...namedEntries(mixed[2])]
        });
    }

    if (JS_NAME.test(clause)) return bound({ from, kind: 'default', entries: [{ name: null, local: clause }] });

    throw refuse(
        `svelthon — importjs: \`${clause}\` is not an import clause (${where})`,
        source,
        lineno
    );
}

// Lift every `importjs` out of the source, leaving the line blank behind it.
//
// Blank rather than removed, and on the same line rather than rewritten into a
// call: the source map is line-level, `sourceMap()` emits column zero on both
// sides, so a line-preserving pass costs the debugger, the tracebacks and
// `$B.set_lineno` exactly nothing.
function takeImportJs(src, where, lineOffset, allowed) {
    const lines = src.split('\n');
    const continued = continuedLines(src);
    const imports = [];
    const kept = [];

    for (let n = 0; n < lines.length; n++) {
        const line = lines[n];
        const lineno = n + 1 + lineOffset;
        const at = `${where}:${lineno}`;

        if (!continued[n] && IMPORTJS_ANYWHERE.test(line)) {
            // A JavaScript import is hoisted and static; there is no such thing
            // as one inside a branch, and silently hoisting it would be a lie.
            throw refuse(
                `svelthon — importjs must start the line, at the top level (${at})`,
                where,
                lineno
            );
        }

        if (!continued[n] && IMPORTJS.test(line)) {
            if (!allowed) {
                throw refuse(
                    `svelthon — importjs belongs to a component; a .py module declares its ` +
                        `JavaScript with __js__ = {"module": ["name"]} (${at})`,
                    where,
                    lineno
                );
            }

            imports.push(importJsClause(line.trim(), at, where, lineno));
            kept.push('');
            continue;
        }

        kept.push(line);
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

// Python identifiers that JavaScript will not accept as bindings.
//
// Half of them are Python keywords too and can never be written; the rest are
// ordinary Python names an author reaches for without a thought — `default`,
// `new`, `enum`, `interface`, `package`, `static`, `case`. At module level they
// are refused by `refuseReserved`, which says why and what to rename to. They
// stay perfectly usable *inside* a `def`, where the generated module binds
// nothing.
const JS_RESERVED = new Set(`break case catch class const continue debugger default delete do else
enum export extends false function if implements in instanceof interface let new null package
private protected public return static super switch this throw true typeof var void while with
yield arguments eval`.split(/\s+/));

// The hidden functions the markup pass appends, one per expression it compiled.
// The name is chosen in `markup.js`; the two have to agree.
const EXPR_PREFIX = '__expr_';

// Every name the runtime lends the generated code arrives under a `__` spelling.
//
// They used to arrive bare, and a component's own declarations sit in the same
// scope: `group: str = "a"` gave `Identifier 'group' has already been declared`,
// and twenty-one more words did the same — `init`, `track`, `follow`, `schedule`
// among them, each the way a Python author would write it. Neither guard covered
// it: `JS_RESERVED` refuses what JavaScript will not take, and `group` is a fine
// JavaScript name; the locked list refuses Svelthon's own vocabulary, and `group`
// is not one of its words. This is the third list, and the repair was already in
// the file one line above the wound — `helpers as __helpers`.
//
// The list is written out rather than derived, so the spelling exists as text in
// this file: `tests/generated-names.test.js` checks that the markup pass and the
// compiler agree on every `__name`, by reading both files, and a name computed
// at run time is invisible to it. Three of them carry the spelling the markup
// pass emits, which is why this is a map and not a prefix.
const RUNTIME = {
    bind: '__bind',
    track: '__track',
    follow: '__follow',
    pyError: '__pyError',
    pyEvent: '__pyEvent',
    pyAttach: '__pyAttach',
    plainData: '__plainData',
    pyArg: '__pyArg',
    pyData: '__pyData',
    pyBoundary: '__pyBoundary',
    pyCall: '__pyCall',
    pyDef: '__pyDef',
    pyTeardown: '__pyTeardown',
    pyComponent: '__pyComponent',
    pyExpression: '__pyExpression',
    invoke: '__invoke',
    pyExport: '__pyExport',
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
    kept: '__kept',
    unproxied: '__unproxied',
    handOver: '__handOver',
    registerModule: '__registerModule',
    withNamespace: '__withNamespace',
    __pybridge: '__pybridge',
    group: '__group',
    readAttr: '__getattr',
    writeAttr: '__setattr',
    writeItem: '__setitem'
};

const runtimeAliases = (names) =>
    names.map((name) => (RUNTIME[name] === name ? name : `${name} as ${RUNTIME[name]}`)).join(', ');

// How many positional arguments a caller may hand a Python function, read off
// its signature so the wrapper can drop the rest.
//
// It used to be `args.args.length` alone, which is only the middle third of a
// positional signature. `def positional(x, /, y)` puts `x` in `posonlyargs`, so
// the wrapper passed one argument and Python raised about a missing one; and
// `def variadic(*values)` has no `args` at all, so `variadic(2, 3)` answered
// **0**, with nothing raised to say the arguments had been dropped on the way.
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
// container keeping its identity and a scalar made JavaScript's, and
// `selection_`, the list of a `<select multiple>`, item by item.
const COMPARED = /^__expr_(scalar|selection)_/;

// In the markup, and only there, the dot finds a key as well as an attribute:
// `{pep.title}` reads a dict. The same text in the `<script>` stays plain Python
// and raises.
//
// A rule of the template's **text**, so it is applied to the text of the
// functions the markup pass wrote: every attribute read becomes
// `__getattr(value, "name")`, and the assignment a `bind:` writes becomes
// `__setattr(value, "name", new)`. A function of the script that the template
// calls keeps plain Python, and a lambda written in the template keeps the rule
// however late it runs. The places come from Brython's own parser, in
// characters, f-string fields included.
function templateDots(def) {
    let tree;

    try {
        tree = $B._PyPegen.run_parser(new $B.Parser(def, '<template>', 'file'));
    } catch {
        // Left as written: the real compile reports it, with the real file name.
        return def;
    }

    const starts = [0];
    for (let i = 0; i < def.length; i++) if (def[i] === '\n') starts.push(i + 1);

    const begin = (node) => starts[node.lineno - 1] + node.col_offset;
    const end = (node) => starts[node.end_lineno - 1] + node.end_col_offset;

    // The dot of `value.name`: behind the name, across any space between them.
    // Bounded, so a position Brython stopped giving the way this reads it says
    // so rather than walking off the start of the text for ever.
    const dot = (node) => {
        let i = end(node) - node.attr.length - 1;
        while (i >= 0 && def[i] !== '.') i -= 1;
        if (i < 0) throw new Error(`svelthon — no dot found before \`${node.attr}\` in a template expression`);
        return i;
    };

    // `size` orders the insertions made at one place: the widest node's text
    // has to come first, so it is applied last.
    const edits = [];
    const insert = (at, text, node) => edits.push({ from: at, to: at, text, size: end(node) - begin(node) });
    const replace = (from, to, text) => edits.push({ from, to, text, size: 0 });
    // Two texts around a node, outside everything the node holds: the opening
    // one before every opening text at its start, the closing one after every
    // closing text at its end. Half a character wider than the node is what
    // orders them so.
    const wrap = (node, before, after) => {
        const size = end(node) - begin(node) + 0.5;

        edits.push({ from: begin(node), to: begin(node), text: before, size });
        edits.push({ from: end(node), to: end(node), text: after, size: -size });
    };

    // A function whose parameters arrive as functions, `lazy` in `markup.js`:
    // each read of one becomes a call, except where a lambda or a comprehension
    // binds the same name for itself.
    const [def0] = tree.body;
    const lazy = def0 instanceof $B.ast.FunctionDef && def0.name.startsWith('__expr_lazy_')
        ? new Set(def0.args.args.map((one) => one.arg))
        : new Set();

    // The names a target binds: `x`, `(k, v)`, `*rest`.
    const targets = (target, names = []) => {
        if (target instanceof $B.ast.Name) names.push(target.id);
        if (target instanceof $B.ast.Starred) targets(target.value, names);
        for (const one of target.elts || []) targets(one, names);
        return names;
    };

    const within = (shadowed, names) => new Set([...shadowed, ...names]);

    // The names a walrus binds in the scope of `node`: a comprehension's walrus
    // binds in the scope around it, a nested lambda's in its own.
    const walrused = (node, names = [], met = new WeakSet()) => {
        if (!node || typeof node !== 'object' || met.has(node) || node instanceof $B.ast.Lambda) return names;
        met.add(node);
        if (node instanceof $B.ast.NamedExpr) names.push(node.target.id);
        for (const key of Object.keys(node)) if (key !== 'parent') walrused(node[key], names, met);
        return names;
    };

    const seen = new WeakSet();

    // Python's scopes, not the tree's: every child of a node does not see the
    // same names. A lambda's defaults are read where the lambda is written and
    // its body where it runs, with every parameter bound, and every name a walrus
    // binds there, which is local to the whole body. A comprehension's first
    // iterable is read outside it, and each target binds for what follows it.
    const scoped = (node, shadowed) => {
        if (node instanceof $B.ast.Lambda) {
            const args = node.args;
            const params = [...args.posonlyargs, ...args.args, ...args.kwonlyargs]
                .concat(args.vararg ? [args.vararg] : [], args.kwarg ? [args.kwarg] : [])
                .map((one) => one.arg);

            for (const one of [...args.defaults, ...args.kw_defaults]) visit(one, shadowed);
            visit(node.body, within(shadowed, [...params, ...walrused(node.body)]));
            return true;
        }

        const comprehension =
            node instanceof $B.ast.ListComp ||
            node instanceof $B.ast.SetComp ||
            node instanceof $B.ast.DictComp ||
            node instanceof $B.ast.GeneratorExp;

        if (!comprehension) return false;

        let inner = shadowed;

        node.generators.forEach((one, index) => {
            visit(one.iter, index === 0 ? shadowed : inner);
            inner = within(inner, targets(one.target));
            for (const test of one.ifs) visit(test, inner);
        });

        for (const key of ['elt', 'key', 'value']) if (node[key]) visit(node[key], inner);
        return true;
    };

    const visit = (node, shadowed = new Set()) => {
        if (!node || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);

        if (scoped(node, shadowed)) return;

        if (node instanceof $B.ast.Name && node.ctx instanceof $B.ast.Load && lazy.has(node.id) && !shadowed.has(node.id)) {
            insert(end(node), '()', node);
        }

        // A walrus that binds one of those names binds the parameter itself,
        // in a comprehension and in a lambda's default as much as here, and
        // every read of it is a call. So it stores a function that answers its
        // value, and gives the value: `(name := (lambda value: lambda:
        // value)(new))()`, which a read after it calls as one before it calls
        // the template's.
        if (node instanceof $B.ast.NamedExpr && lazy.has(node.target.id) && !shadowed.has(node.target.id)) {
            wrap(node, '(', ')()');
            wrap(node.value, '(lambda value: lambda: value)(', ')');
        }

        const [target] = node instanceof $B.ast.Assign ? node.targets : [];

        if (node instanceof $B.ast.Assign && node.targets.length === 1 && target instanceof $B.ast.Attribute) {
            // The target may stand between parentheses, `(row.label) = new`:
            // the call opens before them and they close around the object.
            const closers = def.slice(end(target), begin(node.value)).replace(/[\s=]/g, '');
            insert(begin(node), '__setattr(', node);
            replace(dot(target), begin(node.value), `${closers}, ${JSON.stringify(target.attr)}, `);
            insert(end(node.value), ')', node.value);
            visit(target.value, shadowed);
            visit(node.value, shadowed);
            return;
        }

        if (node instanceof $B.ast.Attribute && node.ctx instanceof $B.ast.Load) {
            insert(begin(node), '__getattr(', node);
            replace(dot(node), end(node), `, ${JSON.stringify(node.attr)})`);
        }

        for (const key of Object.keys(node)) if (key !== 'parent') visit(node[key], shadowed);
    };

    visit(tree);

    edits.sort((one, other) => other.from - one.from || one.size - other.size);

    return edits.reduce((text, one) => text.slice(0, one.from) + one.text + text.slice(one.to), def);
}

// Two of them are bound only where the name is actually read: `props_id`
// because its value must be computed at the top level rather than lazily, `host`
// because Svelte refuses `$host()` outright in a component that is not a custom
// element.
//
// Asked of the AST, because the question is about a **name**. It used to be a
// text search over the generated JavaScript, and Brython emits a Python string
// literal as a JavaScript one: `role = "host"` became `locals.role = 'host'`, so
// the search matched its own quotation marks. The component then emitted
// `$host()`, Svelte refused it outside a custom element, and a component holding
// that word in a string did not render at all. Every position reached it — a
// dict key, a comparison, an f-string — since the word alone was the test.
//
// A `Name` node is the question, and a `Constant` whose value happens to read
// the same is not. Nor is every `Name`: a parameter or a local called `host`
// reads the function's own binding, not the one injected into the module. So
// the answer is Python's own, its symbol table: a name the module reads is one
// some block uses with a global scope, explicit or implicit.
function globalReads(table) {
    const flags = $B.SYMBOL_FLAGS;
    const found = new Set();

    const visit = (block) => {
        for (const { key, value } of $B.builtins.dict.$iter_items(block.symbols)) {
            const scope = (value >> flags.SCOPE_OFFSET) & flags.SCOPE_MASK;
            if (value & flags.USE && isGlobalScope(scope)) found.add(key);
        }
        block.children.forEach(visit);
    };

    visit(table.top);
    return found;
}

const injectable = (one, declared, component, names) =>
    (component || !one.component) &&
    !declared.includes(one.name) &&
    (!one.whenRead || names.has(one.name));

// A locked name is Svelthon's own word, not a builtin to shadow: refused rather
// than quietly given to either side. Scoped like the injection itself, so a
// component-only word is free in a plain `.py`.
// The compiler's own prefix, and the one rule that keeps it.
//
// Seven families of name are built out of the author's — `__fn_go`, `__rev_c`,
// `__bump_c`, `__read_c`, `__local_n`, `__js_mount`, `__root_loop` — and
// declared in the same scope as the author's names, beside `__proto`. Each was
// measured colliding with the construct that emits it, and what the author saw
// was `Identifier '__fn_go' has already been declared` at a line and column
// inside the emitted script, under a frame of three lines they never wrote.
//
// A prefix rather than a list, because a list cannot cover the family added
// next. And a *trailing* `__` is what makes it safe: every name Python itself
// puts in a module carries one — `__all__`, `__doc__`, `__js__` — measured
// clean, so the rule refuses the compiler's shape and leaves Python's alone.
const COMPILER_PREFIX = /^__(?!.*__$)/;

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
    // parsed — the markup pass's expressions, and the two the arrow rewrites
    // give a name to — so they arrive here among the declared names. They are
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
                `them. Python's own names end with \`__\` as well — \`__all__\`, \`__doc__\` ` +
                `— and those are free.`,
            source,
            at === undefined ? undefined : at + lineOffset
        );
    }

    const taken = INJECTED.find(
        (one) => one.locked && (component || !one.component) && declared.includes(one.name)
    );

    if (!taken) return;

    // `surface()` records where each name was bound, so this one names the line
    // the word was taken on. A name that came from `reserved` rather than from a
    // binding has none, and then the file alone is what there is to say.
    const line = lines?.get(taken.name);
    const at = line === undefined ? source : `${source}:${line + lineOffset}`;

    throw refuse(
        `svelthon — \`${taken.name}\` is one of Svelthon's own words and cannot be ` +
            `redefined (${at}). The helpers, \`date\`, \`slugify\`, \`tojson\` and`  +
            ` the rest, may still be shadowed; the decorators may not.`,
        source,
        line === undefined ? undefined : line + lineOffset
    );
}

// A module-level name JavaScript will not take as a binding.
//
// It used to be dropped in silence, and the three shapes that took were each
// worse than the last. A component rendered its **first** value and then never
// followed it: `new = 2` shows 2, the handler moves the model to 3, the page
// stays at 2, with no error anywhere — the witness beside it, `ok`, repaints.
// A module's `def default()` was simply not exported. And a value named in
// `__all__` reached the refusal below this one and was told *this module never
// binds it*, which is false: the module binds it, JavaScript reserves it. The
// author was sent looking for a typo.
//
// So it is refused, for the reason `injected.cjs` gives about its own list:
// winning in silence is the worst of the three behaviours. The cost is one
// underscore, and Python has a convention for exactly this collision.
//
// After `refuseLocked`, which is given these names too: `export` is both one of
// Svelthon's words and a JavaScript keyword, and *that* is what a reader needs
// to be told first.
function refuseReserved(reserved, source, lines, lineOffset = 0) {
    const [name] = reserved;

    if (name === undefined) return;

    const line = lines?.get(name);
    const at = line === undefined ? source : `${source}:${line + lineOffset}`;

    throw refuse(
        `svelthon — \`${name}\` is a reserved word in JavaScript, and the generated ` +
            `module cannot bind one (${at}). It is good Python and nothing else is ` +
            `wrong with it, but nothing reactive can be built on the name: the page ` +
            `would show its first value and never follow it, and a module cannot ` +
            `publish it. Rename it — Python's own convention for a name that collides ` +
            `with a keyword is a trailing underscore, \`${name}_\`.`,
        source,
        line === undefined ? undefined : line + lineOffset
    );
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

const injections = (declared, component, names) =>
    INJECTED.filter((one) => injectable(one, declared, component, names)).map(
        (one) => `__bind(__proto, '${one.name}', ${one.value}, undefined, undefined, false);`
    );

// The lines those injections need in the component's preamble, before any of
// them is bound.
const injectedPreamble = (declared, component, names) =>
    INJECTED.filter((one) => one.emitted && injectable(one, declared, component, names)).map(
        (one) => one.emitted
    );

// Module-level names, read off the AST rather than the generated JS, since the
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

// `@effect.pre`, a dotted decorator, which is a different AST node: an
// `Attribute` over a `Name`, not a `Name`. The dotted form is PEP 318's original
// grammar, and the one Python uses to name a variant of something: `@property`
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

// Where a statement keeps the statements it holds. `items` is a `with`'s
// context managers, which hold no body of their own but do sit on the path.
const BODIES = ['body', 'orelse', 'finalbody', 'handlers', 'cases', 'items'];

// A rune lives at the top level of a component's module, and nowhere else.
// `surface()` reads the AST and never descends into a `def` or a `class`, so a
// rune written deeper is built and wired to nothing.
//
// The arrow already refused this, by indentation, before parsing. The decorator
// said nothing at all, so the same construct spoke under one spelling and
// vanished under the other, which is worse than either rule on its own.
const RUNE_NAMES = new Set(['effect', 'derived', 'inspect', 'inspect_with']);

const decoratorSpelling = (node) => {
    for (const one of node.decorator_list || []) {
        if (one instanceof $B.ast.Name && RUNE_NAMES.has(one.id)) return `@${one.id}`;
        if (
            one instanceof $B.ast.Attribute &&
            one.value instanceof $B.ast.Name &&
            RUNE_NAMES.has(one.value.id)
        ) {
            return `@${one.value.id}.${one.attr}`;
        }
    }

    return null;
};

function refuseNestedRunes(body, source, lineOffset) {
    const scoped = (statements) => {
        for (const node of statements) {
            const spelling =
                decoratorSpelling(node) ||
                (node instanceof $B.ast.Assign &&
                node.value instanceof $B.ast.Call &&
                node.value.func instanceof $B.ast.Name &&
                RUNE_NAMES.has(node.value.func.id)
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

            for (const key of BODIES) if (node[key]) scoped(node[key]);
        }
    };

    // What a `def` or a `class` holds, and what a block of the module holds: an
    // `if`, a loop, a `try`, a `with` or a `match` runs or not, and a rune is
    // wired whether it ran or not. At the top level these are the mechanism
    // itself, since `x => expr` compiles to `x = derived(lambda: …)`.
    for (const node of body) {
        if (
            node instanceof $B.ast.FunctionDef ||
            node instanceof $B.ast.AsyncFunctionDef ||
            node instanceof $B.ast.ClassDef
        ) {
            scoped(node.body || []);
            continue;
        }

        for (const key of BODIES) if (node[key]) scoped(node[key]);
    }
}

// The two assignments that are declarations to the compiler rather than data to
// the module. Both are read off the AST, and neither is state.
const DIRECTIVES = new Set(['__all__', '__js__']);

// The calls that declare what a name is, in their call spelling.
const MARKERS = ['derived', 'effect', 'inspect', 'inspect_with', 'export'];

function surface(body) {
    const props = [];
    const bindables = [];
    const state = [];
    const funcs = [];
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
    //      spelling. Missing from the list, `date` was injected over the author's
    //      own, and their write went to the injection's no-op setter and was
    //      discarded. `bind()` now writes an own property instead, so this is
    //      belt as well as braces, but the list is the braces;
    //   2. a JavaScript name from `<script module>` is published the same way,
    //      with the same filter;
    //   3. `refuseLocked` refuses the six words of the dialect. `effect = 0` was
    //      refused and `for effect in …` was not, which is a rule that does not
    //      apply rather than a rule with an exception.
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

    const visit = (statements) => {
        for (const node of statements) {
            statement = node.lineno;

            if (node instanceof $B.ast.Assign) {
                for (const target of node.targets) {
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

                    const called = MARKERS.find((one) => isCallTo(node, one));
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
                    if (isCallTo(node, 'derived')) deriveds.push({ name: target.id, arity: 0 });
                    else if (isCallTo(node, 'effect')) effects.push({ name: target.id, arity: 0 });
                    else if (isCallTo(node, 'inspect')) inspects.push({ name: target.id, arity: 0 });
                    // The callable comes first, so the emission takes it off the
                    // front of the evaluated list rather than out of the source.
                    else if (isCallTo(node, 'inspect_with'))
                        inspects.push({ name: target.id, arity: 0, logger: true });
                    // `focus = export(lambda: field.focus())`, the call form of
                    // `@export`, and the shape their own `export const focus =
                    // () => …` has. Every other marker here answers to both
                    // spellings; this one answering to only the decorator was an
                    // omission, not a rule. The arity comes off the lambda, since
                    // unlike a derived or an effect an exported function is
                    // called with arguments.
                    else if (isCallTo(node, 'export'))
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
                if (node.target instanceof $B.ast.Name && take(node.target.id)) {
                    (isBindable(node) ? bindables : props).push(node.target.id);
                }
            } else if (
                // `async def` is a different AST node, and missing it left async
                // handlers undefined: a click did nothing at all, silently.
                node instanceof $B.ast.FunctionDef ||
                node instanceof $B.ast.AsyncFunctionDef
            ) {
                bind(node.name);

                const decorated = decoratorSpelling(node) ?? (hasDecorator(node, 'export') ? '@export' : null);
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
                const pre = hasDottedDecorator(node, 'effect', 'pre');
                const root = hasDottedDecorator(node, 'effect', 'root');
                const entry = {
                    name: node.name,
                    arity: arityOf(node.args),
                    ...(pre ? { pre: true } : {}),
                    ...(root ? { root: true } : {}),
                    // `@export` leaves the function where it was: it is an
                    // ordinary function that is *also* reachable from a parent
                    // holding the instance.
                    ...(hasDecorator(node, 'export') ? { exported: true } : {})
                };
                const bucket = hasDecorator(node, 'derived')
                    ? deriveds
                    : hasDecorator(node, 'effect') || pre || root
                      ? effects
                      : funcs;

                bucket.push(entry);
            } else if (node instanceof $B.ast.ClassDef) {
                // A class is a scope, so nothing inside it is module state, and
                // the descent stops here as it always did. The *name* is still
                // the author's, which is the half that was missing.
                bind(node.name);
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
    const globals = (statements) => {
        for (const node of statements) {
            if (node instanceof $B.ast.Global) {
                statement = node.lineno;

                for (const name of node.names || []) {
                    bind(name);
                    if (take(name)) state.push(name);
                }
            }

            for (const key of BODIES) if (node[key]) globals(node[key]);
        }
    };

    globals(body);
    walruses(body);

    return { props, bindables, state, funcs, deriveds, effects, inspects, reserved, bound, lines, remarked, starred };
}

// The modules the source imports, `import x` and `from x import y` alike.
//
// Brython's own bookkeeping, `root.imports`, records `import x` and nothing
// else, so `from counter_store import count` was invisible to the prelude that
// resolves a sibling `.py`, and the component compiled cleanly then failed in
// the browser on a module it had never been given.
//
// Walked rather than read off the top level, because an import inside a function
// or a `try` is still an import.
//
// Asked of the AST alone. It was asked of the text as well, by a regex anchored
// with `m`, and `^` matches the start of any line — including a line inside a
// triple-quoted string, which is where usage examples live:
//
//     doc = """
//     from effet import quelque_chose
//     """
//
// The prelude then carried a real `import` for `effet`, so Vite loaded the file
// and ran its module body, for a name that appears only in documentation. The
// cost was measured as "a name listed that was already going to be"; it was a
// module executed, watched and shipped.
//
// The belt was there for a bundled build with two sets of AST classes, where
// `instanceof` answers false for a node that is plainly an ImportFrom. The walk
// below no longer asks `instanceof` — it recognises the node by shape, for that
// exact reason — so the belt guarded nothing the walk had not already covered.
//
// `import x` is read by the same walk, so every module the source names comes
// with the line that names it first: what a refusal of that import points at.
//
// A relative import, `from . import x` or `from .x import y`, is kept apart: it
// names no module, only a place in a package, and a component is in none.
function moduleImports(ast) {
    const found = new Map();
    const relative = [];
    const add = (module, node) => {
        if (!found.has(module)) found.set(module, node.lineno);
    };

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
        // module name, an alias list and a level together, and a relative
        // import (`from . import x`) names no module.
        const importFrom =
            typeof node.module === 'string' && Array.isArray(node.names) && typeof node.level === 'number';

        // An Import carries aliases and no level; a `global` carries names that
        // are plain strings.
        const importNode =
            Array.isArray(node.names) && typeof node.level !== 'number' && typeof node.names[0]?.name === 'string';

        const dotted = Array.isArray(node.names) && node.level > 0;

        // `from browser import timer` imports the submodule `browser.timer`
        // when Brython's catalogue names one, rather than an attribute.
        if (dotted) relative.push(node);
        else if (importFrom) {
            add(node.module, node);
            for (const one of node.names) {
                const submodule = `${node.module}.${one.name}`;
                if ($B.stdlib[submodule]) add(submodule, node);
            }
        }
        if (importNode) for (const one of node.names) add(one.name, node);

        for (const key of BODIES) if (node[key]) walk(node[key]);
    };

    walk(ast.body);
    return { found, relative };
}

// A relative import has no package to be relative to, and fails at mount with
// `ImportError`. A neighbouring module is named by its own name, which is what
// the refusal writes out.
function refuseRelativeImports(relative, source, lineOffset) {
    const [node] = relative;
    if (!node) return;

    const aliases = node.names.map((one) => (one.asname ? `${one.name} as ${one.asname}` : one.name)).join(', ');
    const absolute = node.module ? `from ${node.module} import ${aliases}` : `import ${aliases}`;
    const line = node.lineno + lineOffset;

    throw refuse(
        `svelthon — a relative import has no package to be relative to: a module ` +
            `beside the component, or on \`path\`, is imported by its own name, ` +
            `\`${absolute}\` (${source}:${line})`,
        source,
        line
    );
}

// The modules the runtime holds, the ones `brython_runtime.js` registers as it
// loads. Python's standard library does not ship: anything else an `import`
// names is one of the project's own files or nothing, and Brython, looking for
// nothing, raises `JavascriptError` rather than `ImportError`.
// `tests/provided-modules.test.js` holds this list to the runtime's.
const PROVIDED_MODULES = new Set([
    'browser',
    'browser.aio',
    'browser.html',
    'javascript',
    'builtins',
    '_sys',
    '_warnings',
    '_importlib',
    '_suggestions'
]);

// What stands in for the standard modules an author reaches for first.
const MODULE_INSTEAD = {
    json: '`from_json(text)` reads JSON and `tojson(value)` writes it',
    math: '`abs`, `round`, `min`, `max` and `pow` are builtins, and `js.Math` holds the rest',
    random: '`js.Math.random()` draws a number',
    datetime: '`date` and `fromnow` show a date, and `js.Date` reads the clock',
    time: '`js.Date.now()` reads the clock'
};

// An `import` of a module that is neither the runtime's nor a file of the
// project, refused on its line: in the browser it would fail at mount.
// `resolves` answers `'file'`, `'package'` when the name's first segment is a
// directory of the project, or nothing.
function refuseMissingModules(importedAt, resolves, source, lineOffset) {
    for (const [module, line] of importedAt) {
        const found = PROVIDED_MODULES.has(module) ? 'file' : resolves(module);
        if (found === 'file') continue;

        const [first] = module.split('.');
        const instead = MODULE_INSTEAD[module];

        // A module resolves by its file name alone, beside the component or on
        // `path`: a directory is not a package.
        const reason =
            found === 'package'
                ? `\`${first}\` is a directory, and a module is found by its file ` +
                  `name alone, beside the component or on \`path\`, not through a ` +
                  `package; put the module beside the component, or add \`${first}\` ` +
                  `to \`path\` and import the module by its own name`
                : `Python's standard library does not ship, only \`browser\`, ` +
                  `\`javascript\` and the project's own \`.py\` files do` +
                  (instead ? `; ${instead}` : '');

        throw refuse(
            `svelthon — \`${module}\` is not a module a component can import: ` +
                `${reason} (${source}:${line + lineOffset})`,
            source,
            line + lineOffset
        );
    }
}

// The names the emitted script gives to what it generates. Pure functions of the
// author's name. `markup.js` writes calls to the same spellings, and
// `tests/generated-names.test.js` holds the two files to them.
const fn = (name) => `__fn_${name}`;
const local = (name) => `__local_${name}`;
// A prop's override by the child, the default it falls back on, and the choice
// between them and the parent's.
const over = (name) => `__over_${name}`;
const fallback = (name) => `__default_${name}`;
const pick = (name) => `__pick_${name}`;
// A `bindable` prop's last scalar written by Python, beside the number Svelte
// was handed for it (`handOver`).
const crossed = (name) => `__crossed_${name}`;
// What `$effect.root` hands back. Python reads the decorated name and gets
// this, exactly as JavaScript reads `const destroy = $effect.root(…)`, and
// the name belongs to the destructor on both sides.
const destroyer = (name) => `__root_${name}`;

// Whether the component's subscriptions have holders besides the component:
// a root effect, which lives until its destructor is called.
const holders = (c) => !c.store && SUBSCRIBING(c) && c.effects.some((e) => e.root);
// Second signal per name: a mutation bumps it without touching the value,
// so nothing is copied and the object keeps its identity.
// The instance's list of subscriptions, and whether it has any to make. A
// component that holds no state and no bindable never calls `track`, so it gets
// neither the list nor the teardown that empties it.
const SUBS = '__subs';

// The setter's parameter, in every `bind()` below.
//
// It was `v`, and `v` is what anyone writes after a decade of
// `for k, v in d.items()`. A module-level name gets a binding, and the setter
// assigns to it, so for that one spelling the parameter shadowed the cell the
// assignment was meant for: `(${NEXT_VALUE}) => { v = __track(${NEXT_VALUE},…) }` writes the parameter,
// the `let v` is never touched, and the name is `<Javascript undefined>` for the
// life of the component. Nothing is reported at any point.
//
// Probed against `value`, `one`, `n`, `f`, `fn`, `key`, `x`, `a`, `init`,
// `bind`, `track`, `follow`, `err`, `teardown` and `args`: `v` was the only
// collision, because it was the only bare name the generated code gave itself.
// So it carries the prefix the rest of the generated code carries.
//
// `JS_RESERVED` did not catch it and could not: `v` is a perfectly good
// JavaScript binding. The locked words did not either: `v` is not Svelthon's
// vocabulary. This is a third category, a name the generated code uses for
// itself, and the answer to that category is a prefix rather than a list.
const NEXT_VALUE = '__next';
const SUBSCRIBING = (c) =>
    c.state.length > 0 || c.funcs.length > 0 || c.bindables.length > 0 || c.props.length > 0 || c.starred;

const rev = (name) => `__rev_${name}`;
const bump = (name) => `__bump_${name}`;
const read = (name) => `__read_${name}`;

// The component script, one function per section.
//
// Each takes the same context object, what `compile()` read off the source,
// and hands back its lines. They are assembled in `componentSections` order,
// which is load-bearing in four places and asserted by `tests/sections.test.js`.

function preamble(c) {
    return [
        `import { init as __init } from ${JSON.stringify(virtualId(c.name))};`,
        // The bridge behind `__truthy` and the three beside it. Imported under a
        // name no one would type: it was called `py` back when a template's
        // expressions were JavaScript and an author wrote `py.str(items)` in the
        // markup, short on purpose. Now that only generated code touches it,
        // short is exactly wrong, and `py` is a name an author may want.
        `import { ${runtimeAliases([
            'bind', '__pybridge', 'track', 'follow', 'pyError',
            'pyEvent', 'pyAttach', 'plainData', 'pyArg', 'pyData', 'pyBoundary', 'pyComponent', 'pyExpression',
            'jsCall',
            'ticking', 'pyBind', 'NONE', 'helpers',
            'directiveAction', 'directiveTransition', 'directiveAnimate',
            'plainScalar', 'storeMember', 'invoke',
            ...(c.store ? ['registerModule'] : SUBSCRIBING(c) ? ['unsubscribe'] : []),
            ...(c.bindables.length ? ['kept', 'unproxied', 'handOver'] : []),
            // Only an effect and `on_mount` hand a value back to be called
            // later, so only a component with one needs the name.
            ...(c.effects.length || c.lifecycle('on_mount') ? ['pyTeardown'] : []),
            // Three that keep the spelling the markup pass emits, and the read
            // half of the dot, which `templateDots` writes.
            'group', 'readAttr', 'writeAttr', 'writeItem'
        ])} } from 'svelthon/runtime';`,
        ...c.jsImports.map(jsImportLine),
        `import { ${['getContext', 'setContext']
            .concat(c.lifecycle('on_mount') || c.lifecycle('on_destroy') ? ['untrack'] : [])
            .join(', ')} } from 'svelte';`,
        ``
    ];
}

function declarations(c) {
    return [
        ...(c.bindables.length
            ? [
                  `let { ${c.bindables.map((b) => `${b} = $bindable()`).join(', ')}, ...__props } =` +
                      ` $props();`,
                  ...c.bindables.flatMap((b) => [
                      `let ${crossed(b)} = null;`,
                      `let ${rev(b)} = $state.raw(0);`,
                      `const ${bump(b)} = () => { ${rev(b)} += 1; };`,
                      `const ${read(b)} = () => { ${rev(b)}; };`
                  ]),
                  // The module body applies the annotation's default by writing
                  // to the name, and that write must not travel up to the
                  // parent. Only writes made after init() are real ones.
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
        // reassigning a prop does in Svelte, until the parent passes a new one.
        // The default init() writes is not an override. A prop passed as
        // `undefined` takes the default, as in Svelte; `null` is a value.
        //
        // Svelte's own rule for the absence, read in `props.js`: the default is
        // the one declared once the parent has passed a value, and a write the
        // child made while nothing was passed until then. So the default is
        // kept apart from the child's writes, and `due` says which one an
        // absence reads.
        ...c.props.flatMap((n) => [
            `let ${local(n)} = $state.raw(undefined);`,
            `let ${rev(n)} = $state.raw(0);`,
            `let ${over(n)};`,
            `const ${fallback(n)} = { value: undefined, due: false };`,
            `const ${bump(n)} = () => { ${rev(n)} += 1; };`,
            `const ${read(n)} = () => { ${rev(n)}; };`,
            `const ${pick(n)} = () => {` +
                ` const __passed = __props.${n};` +
                ` if (__passed === undefined) return ${fallback(n)}.due ? ${fallback(n)}.value : ${local(n)};` +
                ` ${fallback(n)}.due = true;` +
                ` if (${over(n)} !== undefined) { if (Object.is(__passed, ${over(n)}.at)) return ${local(n)}; ${over(n)} = undefined; }` +
                ` return __passed; };`,
            // Read by Svelte's own compiler and not by ours: a snippet is a
            // prop, and `{@render name(…)}` references the bare name. Python
            // reaches the same value through the namespace accessor below, and
            // that is the copy a falsy value has to survive. This one is
            // Svelte's, so its absence is JavaScript's: None is `undefined`,
            // which `{@render name?.()}` skips as it skips an omitted prop.
            `const ${n} = $derived.by(() => { ${rev(n)}; const __given = ${pick(n)}(); return __given === __NONE ? undefined : __given; });`
        ]),
        ...c.state.flatMap((n) => [
            `let ${n} = $state.raw(undefined);`,
            `let ${rev(n)} = $state.raw(0);`,
            `const ${bump(n)} = () => { ${rev(n)} += 1; };`,
            `const ${read(n)} = () => { ${rev(n)}; };`
        ]),
        // A `def`'s cell is a state cell: a decorator or a later line may put a
        // list there, and its mutations are followed as any name's are.
        ...c.funcs.flatMap((f) => [
            `let ${fn(f.name)} = $state.raw(undefined);`,
            `let ${rev(f.name)} = $state.raw(0);`,
            `const ${bump(f.name)} = () => { ${rev(f.name)} += 1; };`,
            `const ${read(f.name)} = () => { ${rev(f.name)}; };`
        ]),
        ...c.inspects.map((i) => `let ${fn(i.name)} = $state.raw(undefined);`),
        ...c.effects.flatMap((e) =>
            e.root
                ? [`let ${fn(e.name)} = $state.raw(undefined);`, `let ${destroyer(e.name)};`]
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
        ...(!c.store && SUBSCRIBING(c) ? [`const ${SUBS} = [];`] : []),
        // How an error's Python line becomes a line of this file; see `inFile`
        // in the runtime. Only a component has template functions to place.
        ...(c.store ? [] : [`const __lines = ${JSON.stringify(c.lines)};`]),
        ``
    ];
}

// What a compiled template expression calls, and only a `.svelte` has one: a
// `.svelte.py` holds signals but no markup, exactly as a plain `.py` holds
// neither.
function templateBridge(c) {
    if (c.store) return [];

    return [
        `const __event = (fn) => __pyEvent(fn, __lines);`,
        `const __attach = (fn) => __pyAttach(fn, __lines);`,
        // What `(name := value)` in a handler compiles to. The write goes
        // through the namespace, so through the accessor, so the signal fires:
        // the whole reason the walrus can mean this here.
        `const __assign = (name, value) => { ${NS}[name] = value; return value; };`
        // The same walrus aimed at an attribute or a key rather than a name,
        // and `bind:group`'s action, are imported under the names the markup
        // pass emits — `__setattr`, `__setitem`, `__group` — rather than
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
function authorBindings(c) {
    return [
        `const __proto = {};`,
        // The names a `from m import *` binds get their accessors at run time,
        // in a component unsubscribed with its own list; a store keeps its
        // subscriptions for as long as the page.
        ...(c.starred
            ? [`Object.defineProperty(__proto, '$svelthonStarred', { value: { owner: ${c.store ? 'undefined' : SUBS} } });`]
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
        // derived.
        ...c.props.map(
            (n) =>
                `__bind(__proto, '${n}', () => (${rev(n)}, __follow(__pyBind(${pick(n)}()))),` +
                ` (${NEXT_VALUE}) => { const __written = __track(${NEXT_VALUE}, ${bump(n)}, ${read(n)}, ${SUBS});` +
                ` if (__initialising) { ${fallback(n)}.value = __written; ${local(n)} = __written; return; }` +
                ` if (__props.${n} !== undefined) ${over(n)} = { at: __props.${n} }; else ${fallback(n)}.due = false;` +
                ` ${local(n)} = __written; ${bump(n)}(); },` +
                ` () => ${pick(n)}());`
        ),
        // What Svelte hands back for a write it kept for itself may be its own
        // proxy of it: `kept` and `unproxied` give Python its object again. A
        // scalar goes up as JavaScript's own, its original kept beside it
        // (`handOver`).
        ...c.bindables.map(
            (b) =>
                `__bind(__proto, '${b}', () => (${rev(b)}, __follow(__pyBind(__unproxied(${b}, ${crossed(b)})))),` +
                ` (${NEXT_VALUE}) => { if (!__initialising || ${b} === undefined) { const __written = __track(${NEXT_VALUE}, ${bump(b)}, ${read(b)}${c.store ? '' : `, ${SUBS}`}); ${crossed(b)} = __handOver(__written, (__crossing) => { ${b} = __crossing; }); __kept(${b}, __written); } }, () => ${b});`
        ),
        // Reading the revision alongside the value is what registers the
        // dependency: an in-place mutation then invalidates every reader,
        // without the value ever changing identity.
        ...c.state.map(
            (n) =>
                `__bind(__proto, '${n}', () => (${rev(n)}, ${n}), (${NEXT_VALUE}) => { ${n} = __track(${NEXT_VALUE}, ${bump(n)}, ${read(n)}${c.store ? '' : `, ${SUBS}`}); });`
        ),
        // A store's function is read from another module, where the namespace is
        // an ordinary JavaScript object and Brython converts what it is given.
        // A component's is not, so it keeps the bare binding.
        ...c.funcs.map(
            (f) =>
                `__bind(__proto, '${f.name}', () => ` +
                `(${rev(f.name)}, ${c.store ? `__pyBoundary(${fn(f.name)})` : fn(f.name)}), ` +
                `(${NEXT_VALUE}) => { ${fn(f.name)} = __track(${NEXT_VALUE}, ${bump(f.name)}, ${read(f.name)}${c.store ? '' : `, ${SUBS}`}); }, () => ${fn(f.name)});`
        ),
        ...c.inspects.map(
            (i) => `__bind(__proto, '${i.name}', () => ${fn(i.name)}, (${NEXT_VALUE}) => { ${fn(i.name)} = ${NEXT_VALUE}; });`
        ),
        // A root's name reads as its destructor; the setter still takes the
        // function, since that is what Brython writes when the `def` runs.
        ...c.effects.map((e) =>
            e.root
                ? `__bind(__proto, '${e.name}', () => ${destroyer(e.name)}, (${NEXT_VALUE}) => { ${fn(e.name)} = ${NEXT_VALUE}; }, () => ${fn(e.name)});`
                : `__bind(__proto, '${e.name}', () => ${fn(e.name)}, (${NEXT_VALUE}) => { ${fn(e.name)} = ${NEXT_VALUE}; });`
        ),
        // __follow(): a @derived that hands back a container it was given is the one
        // place the revision cannot travel by itself: Svelte memoises the
        // derived on `===`, so the reader subscribes to the object instead.
        ...c.deriveds.map(
            (d) =>
                `__bind(__proto, '${d.name}', () => __follow(${d.name}), (${NEXT_VALUE}) => { ${fn(d.name)} = ${NEXT_VALUE}; }, () => ${fn(d.name)});`
        )
    ];
}

function namespaceObject(c) {
    return [
        ``,
        `const ${NS} = Object.create(__proto);`,
        // Reading a global goes through $B.resolve_global → resolve_in_namespace,
        // which demands an *own* property unless the namespace is flagged
        // $proxy, in which case it reads the property normally and therefore
        // walks the prototype chain, where our accessors live. It is the only
        // place in Brython that consults this flag.
        `${NS}.$proxy = true;`,
        // Every namespace Brython makes for itself carries the module's own
        // name, and `from x import y` reads it off the *importing* module to
        // work out what package it sits in. Ours had none, so the lookup asked
        // for a module called `undefined`, and said so, in a component where
        // `import x` on the line above had worked perfectly.
        `${NS}.__name__ = ${JSON.stringify(c.namespace)};`
    ];
}

// The JavaScript names a module reaches for, wrapped and published.
//
// Wrapped once and not on every read: a name Python compares by identity,
// `handler is on_click`, has to answer the same object twice. And a name Python
// declares itself wins, which is what the filter is for.
//
// `extra` is what a component has and a plain `.py` cannot: the names its
// `<script module>` imported. They are wrapped like the rest and bound like the
// rest, so the only difference between the two paths is that list, which is why
// this is one function rather than the same six lines twice.
function jsNameBindings(c, extra = []) {
    // Once each. The two lists overlap whenever a component names the same
    // import in its `<script module>` and in an `importjs`, and the two loops
    // this replaces then bound it twice: the same line, emitted after itself.
    const names = [...new Set([...c.jsImported, ...extra])].filter(
        (n) => !c.declared.includes(n)
    );

    // **Read at every access, because a name is a binding and not a value.**
    // This took `__jsCall(n)` once into a `const` and handed that back for ever,
    // so `let amount = 1` in a `<script module>` reached Python as `1` after the
    // JavaScript had moved on — and not only where reactivity was in question:
    // a Python function that *asked again* still read the old number.
    //
    // Safe to read afresh because the adaptation is memoised per function
    // (`ADAPTED` in runtime.js): the same function gives the same proxy, so a
    // callback registered from Python can still be taken back.
    return names.map((n) => `__bind(__proto, '${n}', () => __jsCall(${n}));`);
}

// Everything the compiler adds: the injected helpers, the template bridge's
// entries, the JavaScript names and the Python modules a directive names. All
// of it after `authorBindings`, so a name the author declared always wins.
function injectedBindings(c) {
    return [
        ...injectedPreamble(c.declared, true, c.names),
        ...injections(c.declared, true, c.names),

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
                  `__bind(__proto, '__spread', () => __pybridge.spread);`,
                  `__bind(__proto, '__bound', () => __pybridge.bound);`,
                  `__bind(__proto, '__assign', () => __assign);`,
                  `__bind(__proto, '__getattr', () => __getattr);`,
                  `__bind(__proto, '__setattr', () => __setattr);`,
                  `__bind(__proto, '__setitem', () => __setitem);`
              ]),
        // The second argument is what the component imported in its
        // `<script module>`, published so Python can read it.
        ...jsNameBindings(c, c.jsNames)
    ];
}

// Running the module body, which is what fills every cell the sections above
// declared. Nothing that reads a Python name may come before it.
// A store's name as JavaScript reads it, from `value`, the expression that reads
// what it holds now; `call` is a `def`'s own wrapper.
const storeRead = (c, name, value, call) =>
    `${RUNTIME.storeMember}(${value}, ${JSON.stringify(`${name}() — ${c.source}`)}, ${c.lineOffset}${call === undefined ? '' : `, ${call}`})`;

// The sentence for a name `__all__` lists and the module does not bind, said by
// the compiler when nothing in the source can bind it, and by the module once
// it has run when a `from m import *` could have.
const neverBinds = (name, where) =>
    `svelthon — \`__all__\` names \`${name}\`, which this module never binds (${where}). A module ` +
    `exports what it defines: check the spelling, or remove it from the list.`;

// Right after `__init`, the first moment the namespace holds what the star
// imports brought, and before any export reads it. Unbound reads `undefined`
// on the namespace, which is what `del` leaves too.
const unboundRefusals = (c) =>
    c.unbound.map(
        (n) => `if (${NS}[${JSON.stringify(n)}] === undefined) throw new Error(${JSON.stringify(neverBinds(n, c.listedAt))});`
    );

function initCall(c) {
    return [
        ``,
        `__init(${NS});`,
        ...unboundRefusals(c),
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
        // `pyComponent`, and not the wrapper written out here. It was the last
        // boundary this file spelled itself, and a rule added to the runtime's
        // own could not reach a template literal: the conversion of an action's
        // arguments landed at two of the three wrappers and stopped here.
        // A **reader** for the component's own functions, and the written-out
        // call for a template expression. The two wrappers differ in what they
        // are given because they differ in what the name means: an author's
        // `def` may sit under a decorator, so its value has to be read at the
        // call, and an `__expr_N` is this compiler's own and never moves.
        ...c.funcs.map((f) =>
            componentWrapper(f) === RUNTIME.pyExpression
                ? `const ${f.name} = ${RUNTIME.pyExpression}((a) => ${fn(f.name)}(...a), ` +
                  `${JSON.stringify(`${f.name}() — ${c.source}`)}, __lines, ${f.arity}, ` +
                  `${KEPT_PYTHON.test(f.name) ? 'true' : COMPARED.test(f.name) ? `'${f.name.match(COMPARED)[1]}'` : 'false'});`
                : `const ${f.name} = ${RUNTIME.pyComponent}(() => ${fn(f.name)}, ` +
                  `${JSON.stringify(`${f.name}() — ${c.source}`)}, ${c.lineOffset});`
        ),
        // What a parent holding `bind:this` can call. Svelte gathers whatever an
        // instance script exports into `$$exports` and hands that object back,
        // so a specifier list is enough: measured, `export { focus }` becomes
        // `var $$exports = { focus }`.
        //
        // A component with no `@export` exports nothing, which is theirs too: an
        // instance exposes only what it says it exposes.
        ...(!c.store && c.funcs.some((f) => f.exported)
            ? [``, `export { ${c.funcs.filter((f) => f.exported).map((f) => f.name).join(', ')} };`]
            : []),
        ...(c.store
            ? [
                  ``,
                  ...registration(c),
                  ``,
                  // Module-scope signals live once for the whole app. Exported
                  // through getters because Svelte forbids exporting a reassigned
                  // $state binding directly, and a getter is what keeps the read
                  // reactive at the call site.
                  // `__all__` says what a module exports, and it said it in a
                  // `.py` and nothing at all here: the store published every
                  // name it had, so the same declaration meant "this is the
                  // contract" in one file kind and was ignored in the other.
                  // `c.published` lets every name through when the module
                  // wrote no `__all__`.
                  //
                  // What a getter hands JavaScript is a crossing too, the other
                  // way, decided by the value the name holds when it is read and
                  // not by what bound the name: `__storeMember` makes a float a
                  // number, keeps a container itself, and hands a Python
                  // callable over as a call, a `def` through its own wrapper.
                  `export const store = {`,
                  ...c.state
                      .filter(c.published)
                      .map((n) => `    get ${n}() { return (${rev(n)}, ${storeRead(c, n, n)}); },`),
                  ...c.unsignalled.map((n) => `    get ${n}() { return ${storeRead(c, n, `${NS}.${n}`)}; },`),
                  // The parameter and the name its body reads are one constant.
                  // They were two: the signature still said `v` while the body
                  // had moved to `__next`, so every published setter of every
                  // store answered `ReferenceError: __next is not defined` —
                  // `store.count = 7` did nothing and said that, while
                  // `store.increment()` worked, which is what kept it hidden.
                  // `__pyArg`, because this setter is a **crossing**, and it was
                  // the only one in the project that treated its value as
                  // already Python. `store.amount = 0.25` put a raw JavaScript
                  // number where Python expected a float: `type(amount)`
                  // answered `JSObject` and `format(amount, ".2f")` raised
                  // *non-empty format string passed to object.__format__*, while
                  // `store.set_amount(0.25)` beside it worked — one value, two
                  // capabilities, decided by the door it came through. The table
                  // of crossings in runtime.js lists this door and its getter.
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
                      .map((f) => `    get ${f.name}() { return ${storeRead(c, f.name, `${NS}.${f.name}`, f.name)}; },`),
                  `};`,
                  ``,
                  `export default store;`,
                  // Named exports too: a `.py` is not only a store. SvelteKit
                  // looks for `load`, `actions`, `GET`, by name, on the module.
                  // Read once the module has run, as a `.py` reads its own: a
                  // `def` a decorator turned into data is published as data.
                  // Through the namespace, as the getter above reads it: the
                  // cell itself read at the top of the module is what Svelte
                  // reports as `state_referenced_locally`.
                  ...(c.funcs.filter((f) => c.published(f.name)).length
                      ? [
                            ``,
                            ...c.funcs
                                .filter((f) => c.published(f.name))
                                .map((f) => `const __export_${f.name} = ${storeRead(c, f.name, `${NS}.${f.name}`, f.name)};`),
                            `export { ${c.funcs
                                .filter((f) => c.published(f.name))
                                .map((f) => `__export_${f.name} as ${f.name}`)
                                .join(', ')} };`
                        ]
                      : [])
              ]
            : [])
    ];
}

// Last, because an effect runs its body the moment it is created: anything it
// reads has to exist, and that means every wrapper above it.
function effectBlocks(c) {
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
        // the cell there is what `state_referenced_locally` reports — twice per
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
        // A root outlives the component and reads the same names, so the
        // subscriptions go when the last of them lets go: the component
        // unmounted and every root destroyed. Declared before the roots, which
        // run as soon as they are created.
        ...(holders(c)
            ? [
                  ``,
                  `let __holders = ${1 + c.effects.filter((e) => e.root).length};`,
                  `const __release = () => { if (--__holders === 0) __unsubscribe(${SUBS}); };`
              ]
            : []),
        // A root owns its own scope: it is not cleaned up when the component is,
        // which is the point: the destructor is handed to Python under the
        // decorated name, and calling it is what ends the effect.
        ...c.effects.flatMap((e) => [
            ``,
            // `root` is a scope and `pre` is a moment, so they compose rather
            // than exclude each other, which is what stacking the two
            // decorators says, and what the nesting emits.
            e.root
                ? `${destroyer(e.name)} = $effect.root(() => { $effect${e.pre ? '.pre' : ''}(() => {`
                : `$effect${e.pre ? '.pre' : ''}(() => {`,
            `    let teardown;`,
            `    try { teardown = __invoke(${fn(e.name)}); }` +
                ` catch (err) { throw __pyError(err,${JSON.stringify(`${e.name}() — ${c.source}`)}, ${c.lineOffset}); }`,
            // What an effect hands back is a *Python* value, so the question is
            // whether Python can call it, not whether JavaScript can. A bound
            // method is `resource.close`, the plainest teardown there is, and it
            // is a Brython object: `typeof` calls it `object`, the line below
            // dropped it, and the resource was never released — no error, no
            // warning, the effect simply had no cleanup. Same for a callable
            // instance. `pyTeardown` answers the wide question and hands back
            // something JavaScript can call, receiver included, or nothing. An
            // `async def` hands back a coroutine, which it starts instead.
            `    const __cleanup = ${RUNTIME.pyTeardown}(teardown, ${JSON.stringify(`${e.name}() — ${c.source}`)}, ${c.lineOffset});`,
            `    if (__cleanup) return () => { __cleanup(); };`,
            e.root ? (holders(c) ? `}); return __release; });` : `}); });`) : `});`
        ]),
        // The other end of `track`. Its own effect rather than a line in the one
        // below, because that one exists only when the author wrote a lifecycle
        // hook, and every instance that holds state has signed onto something.
        ...(holders(c)
            ? [``, `$effect(() => () => __release());`]
            : !c.store && SUBSCRIBING(c)
              ? [``, `$effect(() => () => __unsubscribe(${SUBS}));`]
              : []),
        ...(c.lifecycle('on_mount') || c.lifecycle('on_destroy')
            ? [
                  ``,
                  `$effect(() => {`,
                  // untrack, because a hook reads the component's names through
                  // the namespace accessors, and those reads are signal reads.
                  // `mounts += 1` inside on_mount would otherwise make the effect
                  // depend on state it also writes, and Svelte loops until it
                  // gives up with effect_update_depth_exceeded.
                  //
                  // Captured while the component is alive, too: reading a signal
                  // from a teardown, once destroyed, yields no function at all.
                  // Held in the wrapper `on_mount` goes through, which starts
                  // an `async def` and places an error.
                  //
                  // A hook is the value its name holds once the script has run,
                  // not the `def` the compiler saw: a `def` under an `if` not
                  // taken leaves the name unbound, which here is `undefined`, as
                  // `del` leaves it, and a hook nobody bound is not called, as
                  // Svelte's `onMount` in a branch not taken is never
                  // registered. Any other value is called and reports its own
                  // error.
                  ...(c.lifecycle('on_destroy')
                      ? [
                            `    const __teardown = untrack(() => { const held = ${fn('on_destroy')};` +
                                ` return held === undefined ? undefined : __pyComponent(() => held, ${JSON.stringify(`on_destroy() — ${c.source}`)}, ${c.lineOffset}); });`
                        ]
                      : []),
                  // What `on_mount` hands back is its cleanup, as with Svelte's
                  // `onMount`, and it runs before `on_destroy`.
                  ...(c.lifecycle('on_mount')
                      ? [
                            `    const __unmounted = untrack(() => ${fn('on_mount')}) === undefined ? undefined :` +
                                ` ${RUNTIME.pyTeardown}(untrack(() => on_mount()),` +
                                ` ${JSON.stringify(`on_mount() — ${c.source}`)}, ${c.lineOffset});`
                        ]
                      : []),
                  `    return () => {`,
                  ...(c.lifecycle('on_mount') ? [`        __unmounted?.();`] : []),
                  ...(c.lifecycle('on_destroy') ? [`        __teardown?.();`] : []),
                  `    };`,
                  `});`
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
        `import { ${runtimeAliases([
            'bind', '__pybridge', 'pyCall', 'pyDef', 'pyError', 'plainData', 'pyArg',
            'pyData', 'pyExport', 'pyBoundary', 'jsCall', 'ticking', 'pyBind', 'NONE', 'helpers',
            'registerModule', 'group', 'invoke'
        ])} } from 'svelthon/runtime';`,
        ...c.jsImports.map(jsImportLine),
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
        // `__assign`, `__group`, `__truthy` and the rest) is emitted. They were,
        // and `__event` named a `pyEvent` this module never imported.
        `const __proto = {};`,
        ...c.state.map((n) => `__bind(__proto, '${n}', () => ${n}, (${NEXT_VALUE}) => { ${n} = ${NEXT_VALUE}; });`),
        ...c.funcs.map(
            (f) =>
                `__bind(__proto, '${f.name}', () => __pyBoundary(${fn(f.name)}), (${NEXT_VALUE}) => { ${fn(f.name)} = ${NEXT_VALUE}; }, () => ${fn(f.name)});`
        ),
        ...c.plainDeriveds.map(
            (d) =>
                `__bind(__proto, '${d.name}', () => __invoke(${fn(d.name)}), (${NEXT_VALUE}) => { ${fn(d.name)} = ${NEXT_VALUE}; }, () => ${fn(d.name)});`
        ),
        ...injections(c.declared, false, c.names),

        // A module has no `<script module>`, so nothing joins its own imports.
        ...jsNameBindings(c),
        ``
    ];
}

// A module published under its Python name. A name no `import` can write,
// `+page.server`, is never looked up, and the module only learns its name.
const registration = (c) => {
    const name = JSON.stringify(pythonModuleName(c.source));

    return PY_NAME.test(pythonModuleName(c.source))
        ? [`__registerModule(${name}, ${NS});`]
        : [`${NS}.__name__ = ${name};`];
};

function plainInit(c) {
    return [
        `const ${NS} = Object.create(__proto);`,
        `${NS}.$proxy = true;`,
        ``,
        ...registration(c),
        `__init(${NS});`,
        ...unboundRefusals(c),
        ``
    ];
}

function plainExports(c) {
    return [
        // `pyCall`, and not a copy of it written out here.
        //
        // This line used to spell the whole boundary again — the trim, the
        // arguments, the coroutine, the conversion, the position — and a rule
        // added to the runtime's own wrapper then held everywhere except here. It
        // cost a defect: a callable *returned* by a module's function crossed
        // with no callback policy, so a bound method handed back by a factory
        // arrived as an object while the same method exported directly was
        // callable.
        //
        // The arrow is what keeps the late binding: `__fn_name` is a `let` the
        // namespace writes into, so the function is read at the call and not
        // captured here.
        ...[...c.funcs, ...c.plainDeriveds].map(
            (f) =>
                `const ${f.name} = __pyDef(() => ${fn(f.name)}, ` +
                `${JSON.stringify(`${f.name}() — ${c.source}`)}, ${c.lineOffset});`
        ),
        ``,
        // SvelteKit reads `load`, `actions`, `GET`, `prerender` by name off the
        // module, so values are exported as well as functions, and a value goes
        // through the boundary too: `actions` is a dict of Python functions, each
        // of them called by the framework.
        //
        // No default export: SvelteKit refuses one on a route module, and a
        // Python module has no notion of a default anyway. Named exports are
        // the whole contract, and `__all__` is where it is written.
        // Read off the namespace and not off a JavaScript binding, because only
        // the *reactive* names have one. A class, an import and a `for` target
        // are the author's names and are correctly not signals, so `${n}` alone
        // referenced something that was never declared: `__all__ = ["Widget"]`
        // on a class emitted `pyExport(Widget, …)` and the module failed to
        // evaluate with `ReferenceError: Widget is not defined`, taking every
        // other export down with it.
        //
        // `__py` is where the module body put every one of them, and reading it
        // through the accessor gives the reactive ones the same value their
        // binding holds. One shape for all of them.
        ...c.exported
            .filter((n) => !c.isFunction(n))
            .map(
                (n) =>
                    `const __export_${n} = __pyExport(${NS}.${n}, ${JSON.stringify(`${n} — ${c.source}`)}, ${c.lineOffset});`
            ),
        ...(c.exported.length
            ? [
                  `export { ${c.exported
                      .map((n) => (c.isFunction(n) ? n : `__export_${n} as ${n}`))
                      .join(', ')} };`
              ]
            : [])
    ];
}

// A number below 2 ** 50, the range of Brython's own random start, drawn from a
// text: two FNV-1a hashes of it, 18 bits of one above 32 of the other.
function counterStart(text) {
    const fnv = (basis) => {
        let hash = basis;
        for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
        return hash;
    };

    return (fnv(0x811c9dc5) & 0x3ffff) * 2 ** 32 + fnv(0x050c5d1f);
}

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
// Nothing breaks if a section moves. Something subtle stops working.
const COMPONENT_SECTIONS = [
    preamble,
    declarations,
    templateBridge,
    authorBindings,
    namespaceObject,
    injectedBindings,
    initCall,
    instanceExports,
    effectBlocks
];

const PLAIN_SECTIONS = [
    plainPreamble,
    plainDeclarations,
    plainBindings,
    plainInit,
    plainExports
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

    // Kept for the error path: the block as the author typed it, before the
    // generated defs join it at column zero.
    const authored = component ? src : '';

    refuseGeneratedSpelling(src, source, lineOffset);

    // `src` is what the author wrote; `defs` are the hidden functions the markup
    // pass produced, one per template expression. They are joined here rather
    // than by the caller because the join carries an invariant, and an invariant
    // living in a comment at three call sites is one that will be got wrong.
    //
    // The invariant is the indentation. A `<script>` body sits inside markup and
    // every Svelte example indents it one level; in JavaScript that is
    // whitespace, in Python it is syntax, and the block raises
    // `IndentationError`, pointing, in Brython, at the line *after* the last
    // one, which tells the author nothing.
    //
    // `$B.unindent` is Brython's own, the one it already runs on every
    // `<script type="text/python">`, so the two tags behave alike and there is no
    // second copy of the rule to keep in agreement. It is private upstream, so
    // the vendored build exposes it in one token (see BRYTHON.md). Its rule is
    // `textwrap.dedent`'s with a conservative bail (one non-blank line already at
    // column zero and the source comes back untouched), and blank lines are
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
    // Where each template function lands in the Python source, as `[from, to,
    // line]`, with the file line of the markup it stands for: an error raised
    // inside one, or inside a lambda it made, is reported there rather than at a
    // line of the script that happens to share its number.
    const exprLines = [];

    if (component) {
        const body = $B.unindent(src);

        defs = defs.map(templateDots);
        src = defs.length ? `${body}\n${defs.join('\n\n')}\n` : body;

        let from = body.split('\n').length + 1;

        defs.forEach((def, index) => {
            const to = from + def.split('\n').length - 1;

            if (defLines[index] !== undefined) exprLines.push([from, to, defLines[index], defColumns[index]]);

            from = to + 2;
        });
    }

    const lifted = takeImportJs(src, source, lineOffset, component);

    src = takeArrows(lifted.source, source, lineOffset, component);

    // Brython reads the source back out of this cache to quote the offending
    // line, and `compiler_error` does it without checking: an unregistered
    // filename turns every *compile* error, as opposed to a parse error, which
    // takes another path, into `Cannot read properties of undefined (reading
    // 'split')`. That covers `await` outside a coroutine, `return` and `yield`
    // outside a function, `break` and `continue` outside a loop: the mistakes a
    // beginner actually makes. Registering the source is all it takes to get
    // Brython's own message, which is CPython's.
    $B.file_cache[source] = src;

    // Brython numbers the functions and lambdas it generates from a counter and
    // a tag it draws at random, so that modules compiled apart are unlikely to
    // share a name. Drawn from the file's path instead, they keep that and give
    // one file the same code in every build. Both are given back afterwards,
    // so a page that compiles leaves Brython's own sequence where it was.
    const counter = $B.id_counter(counterStart(source));
    const tag = $B.lambda_magic;
    $B.lambda_magic = counterStart(`${source}#lambda`).toString(36).slice(0, 8);

    let root;
    try {
        root = $B.py2js({ src, filename: source }, name, [name]);
    } catch (error) {
        throw pythonError(error, source, lineOffset, authored, exprLines, src);
    } finally {
        $B.id_counter(counter);
        $B.lambda_magic = tag;
    }
    let { props, bindables, state, funcs, deriveds, effects, inspects, reserved, bound, lines, remarked, starred } =
        surface(root._ast.body);

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
    const js = root.to_js();

    // Brython derives the namespace identifier from the filename alone: `module`
    // and `locals_id` are ignored by js_from_root, so the name to hook is a
    // function of the file and not of `name`. Upstream maps only '.' to '_', so
    // a real path emitted `locals_src/Counter_svelte`, which is not valid
    // JavaScript; the vendored build is patched to neutralise every character
    // that cannot appear in an identifier (see BRYTHON.md). That is what lets
    // the real path be passed, so Python's __file__ names the actual file, which
    // is what a traceback shows.
    //
    // The identifier Brython then derives is `nameFor()`'s own output, so the
    // namespace interception is unaffected.
    const namespace = namespaceFor(source);

    if (!js.includes(namespaceCall(namespace))) {
        throw new Error(
            `svelthon: the code generated for ${source} never calls ${namespaceCall(namespace)}. ` +
                `Brython's codegen no longer exposes the module namespace where Svelthon hooks it`
        );
    }

    // Svelte reserves the '$' prefix for *every* scope inside a component, and
    // Brython's codegen opens with `var $B = __BRYTHON__`. So the generated
    // code lives in its own module, which Svelte never parses.
    const { found: importedAt, relative } = moduleImports(root._ast);
    const imported = [...importedAt.keys()];

    refuseRelativeImports(relative, source, lineOffset);
    if (resolves) refuseMissingModules(importedAt, resolves, source, lineOffset);
    const module = [
        `import { ${runtimeAliases(['withNamespace', 'pyError'])} } from 'svelthon/runtime';`,
        ``,
        `export function init(${NS}) {`,
        `  try {`,
        `    return __withNamespace(${JSON.stringify(namespace)}, ${NS}, () => {`,
        js,
        `    });`,
        `  } catch (err) { throw __pyError(err,${JSON.stringify(source)}, ${lineOffset}); }`,
        `}`
    ].join('\n');

    // The two declarations meet here, in one shape: `__js__` is the module's and
    // only ever names, `importjs` is the component's and covers the four forms.
    const jsImports = [
        ...declaredJsImports(root._ast.body, source, lineOffset).map((one) => ({
            from: one.from,
            kind: 'named',
            entries: one.names.map((n) => ({ name: n, local: n }))
        })),
        ...lifted.imports
    ];
    const jsImported = jsImports.flatMap((one) => one.entries.map((e) => e.local));

    // Lifecycle by convention, mapped onto a single $effect: its body runs once
    // after the DOM exists, its teardown when the component goes away. Both
    // names stay ordinary functions, nothing stops Python calling them too.
    const lifecycle = (hook) => !store && funcs.some((f) => f.name === hook);

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
    refuseReserved(reserved, source, lines, lineOffset);
    refuseRemarked(remarked, source, lines, lineOffset);
    refuseNestedRunes(root._ast.body, source, lineOffset);

    // Functions by default, what a framework calls by name. A module that wants
    // to export values says so with `__all__`, exactly as it would to a Python
    // caller. SvelteKit is strict about it: a `+page.server.py` exporting
    // anything but load/actions/prerender/… is refused, and rightly so.
    const table = symbolTable(root._ast, source);
    const declaration = declaredExports(root._ast, table, source, lineOffset, src);
    const listed = declaration === null ? null : declaration.names;
    const exported = listed ?? [...funcs.map((f) => f.name), ...plainDeriveds.map((d) => d.name)];

    // A name in `__all__` that the module never binds. Python raises on it at
    // `from m import *` and says nothing otherwise; here it used to emit a
    // reference to a name that does not exist, so the module failed to evaluate
    // with `ReferenceError: Widget is not defined` and took everything it
    // exported down with it. Reading the value off the namespace fixed the
    // class and the import, and would have made this one quietly `undefined`.
    //
    // A `from m import *` binds names the source does not spell, so with one
    // the question waits until the module has run (`unboundRefusals`).
    const binds = moduleBinds(table);
    const unbound = (listed ?? []).filter((n) => !declared.includes(n) && !binds.has(n));
    // The name is bound nowhere, so the line is the one `__all__` is on.
    const line = declaration?.line;
    const listedAt = line === undefined ? source : `${source}:${line}`;

    if (unbound.length && !starred) throw refuse(neverBinds(unbound[0], listedAt), source, line);

    // What is left that the module cannot export under its name is what only a
    // star import can bring: a word JavaScript reserves, or no name at all.
    // Refused and named, as a binding of a reserved word is, rather than left
    // out of the exports.
    const unexportable = (listed ?? []).find((n) => !PY_NAME.test(n) || JS_RESERVED.has(n));

    if (unexportable !== undefined) {
        throw refuse(
            `svelthon — \`__all__\` names \`${unexportable}\`, which ` +
                `${PY_NAME.test(unexportable) ? 'JavaScript reserves' : 'is not a name'}, so the module ` +
                `cannot export it (${listedAt}).`,
            source,
            line
        );
    }

    const isFunction = (name) =>
        funcs.some((f) => f.name === name) || plainDeriveds.some((d) => d.name === name);

    // What `__all__` lists and the compiler gave no signal: a class, or a name a
    // star import brought. A store reads it off the namespace, as a `.py` does.
    const unsignalled =
        listed === null
            ? []
            : exported.filter(
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
        store,
        namespace,
        js,
        // Every name the module reads as a global. What decides whether `host`
        // and `props_id` are bound at all — see `globalReads`.
        names: globalReads(table),
        declared,
        emitted,
        // Whether a name belongs to the module's public surface. `__all__` when
        // the module wrote one, everything when it did not.
        published: (name) => listed === null || listed.includes(name),
        imported,
        props,
        bindables,
        state,
        funcs,
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
        lifecycle
    };

    const script = (plain ? PLAIN_SECTIONS : COMPONENT_SECTIONS)
        .flatMap((section) => section(c))
        .join('\n');

    return {
        script,
        module,
        map: sourceMap(module, source, sourceContent ?? src, lineOffset),
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

// A component's props and the Svelte type of each, for a custom element: Svelte
// learns what to observe from a destructured `$props()`, which Svelthon does not
// write, or from `customElement.props`, which this fills. Read off the script
// alone, with its signs rewritten as the compile rewrites them. A script that
// does not parse declares nothing here: the compile says why.
function elementProps(src) {
    let tree;

    try {
        const body = takeArrows(takeImportJs($B.unindent(src), '<props>', 0, true).source, '<props>', 0, true);
        tree = $B._PyPegen.run_parser(new $B.Parser(body, '<props>', 'file'));
    } catch {
        return [];
    }

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

    const { props, bindables } = surface(tree.body);

    return [...props, ...bindables].map((name) => ({ name, type: types.get(name) }));
}

module.exports = { compile, VIRTUAL_PREFIX, virtualId, pythonModuleName, elementProps, PY_NAME };
