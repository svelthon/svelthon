import { TraceMap, traceSegment } from '@jridgewell/trace-mapping';
import { createHash, randomBytes } from 'node:crypto';
import { relative, resolve, dirname, basename } from 'node:path';
import { readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    overMarkup,
    declaresPython,
    pythonScript,
    strayPythonScript,
    pythonExpressions,
    collector,
    moduleScript,
    moduleScriptStart,
    moduleScriptIndex,
    withoutComments,
    markupOnly,
    blankBodies
} from './markup.js';
import { parse } from 'svelte/compiler';
import {
    compile,
    MODULE_READERS,
    RUNES,
    bridgeHooks,
    VIRTUAL_PREFIX,
    virtualId,
    pythonModuleName,
    elementProps,
    scriptSurface,
    runningNames,
    PY_NAME,
    componentImports,
    importedFile,
    importedNames,
    publishedNames,
    scannedScript
} from './compile.js';

// Generated modules, keyed by project and component name. Filled by the preprocessor when
// Svelte transforms a component, read back when Vite resolves the import that
// the preprocessor just wrote into that component's script.
//
// Held on a global registry rather than in this module, because the two halves
// do not always land in the same module instance: SvelteKit loads
// `svelte.config.js` (where the preprocessor is declared) through its own
// loader, while Vite bundles `vite.config.js`, where the plugin is. This file
// is then evaluated twice, and a module-level Map would leave the plugin
// looking in an empty one.
//
// The key holds the project as well as the id: the directory the process was
// in when each half was made, which every name is relative to. Two projects
// built in one process, each with a `src/Card.svelte`, give the same id, and
// each plugin serves its own.
const generated = (globalThis[Symbol.for('svelthon.generated')] ??= new Map());
const generatedKey = (root, id) => `${root}\n${id}`;

// A component's body is told apart by what it was compiled from, under its
// name: one file may be compiled to two components at once, a plugin before
// Svelte's writing it otherwise for `?variant=alpha` and `?variant=beta`, and
// one module for both ran the same Python in each. What it was compiled from is
// the only key there is: the preprocessor is handed the file without the query
// it was asked under.
//
// Each content takes a number, the next one free, and an edit of the file
// hands them out again (`hotUpdate`): a save keeps its ids, which every
// environment asks for again and Vite replaces, where an id per content left
// the server's runner one body more per save, a module nobody asked for again
// being one Vite never lets go. Under `body`, as `v` is the version Vite tells
// a dependency by and serves to be cached for a year.
const slots = (globalThis[Symbol.for('svelthon.slots')] ??= new Map());

const bodyId = (root, name, content, about) => {
    const hash = createHash('sha256').update(content).update(JSON.stringify(about ?? null)).digest('hex');
    const own = generatedKey(root, virtualId(name));
    const taken = slots.get(own) ?? slots.set(own, new Map()).get(own);

    if (!taken.has(hash)) taken.set(hash, taken.size);

    return `${virtualId(name)}?body=${taken.get(hash)}`;
};

// Which file claimed each generated name, on the same global registry and for
// the same reason: the preprocessor and the plugin are not always the same
// module instance. Keyed by project as `generated` is, since a name is unique
// within one: a claim of project A, a path relative to A, was looked for in B,
// and a file B holds and never compiled refused B's own module.
const claimed = (globalThis[Symbol.for('svelthon.claimed')] ??= new Map());

// The name alone, for a caller that is only asking a question. `hotUpdate` runs
// for every file the dev server sees change, component or not, and all it wants
// to know is whether a module of that name exists. Asking must not claim.
//
// The path is read from `root`, the project of the half that asks, the one its
// generated modules are filed under: read from the directory of the moment, a
// change of directory renamed every module, and an edit invalidated none.
const mangle = (filename, root) => shownPath(filename, root).replace(/\W/g, '_');

// A component's path as its project names it, and `Component` for one handed
// over without a file, which no directory holds.
const shownPath = (filename, root) => (filename ? relative(root, filename) : 'Component');

// The name, claimed. Must be unique across the project *and* a valid JS
// identifier, since Brython derives its namespace binding (`locals_<name>`) from
// it.
//
// `\W → _` gives the second and not the first: `src/ui/card.svelte`,
// `src/ui_card.svelte` and `src/ui-card.svelte` all mangle to
// `src_ui_card_svelte`, and one virtual module for two components means one
// runs the other's Python module body. Kebab beside snake is not an exotic
// layout.
//
// Refused rather than made injective. A hash would keep both files working and
// make every generated id unreadable for a collision nobody has had; a refusal
// costs a rename in the one project that meets it, and says which two files.
//
// Only the two hooks that *emit* a module call this, so that asking whether a
// module exists does not claim its name: `hotUpdate` asks for every file the
// dev server sees change, Svelthon's or not.
//
// A claim is never released, the registry living as long as the process, so the
// last condition reads the disk: **a first claimant that is no longer there is
// not a collision, it is a rename.** Nor is one that no longer compiles to the
// name (`stillClaims`): a component turned to JavaScript, a module a directory
// replaced. The refusal keeps the case it is for, two files that both compile.
export const nameFor = (filename, root) => {
    const path = shownPath(filename, root);
    const name = mangle(filename, root);
    const first = claimed.get(generatedKey(root, name));

    if (first !== undefined && first !== path && stillClaims(resolve(root, first))) {
        throw new SyntaxError(
            `svelthon — \`${path}\` and \`${first}\` both compile to the module name ` +
                `\`${name}\`, so one would silently run the other's Python. Rename ` +
                `one of them: the name is the path with every character that cannot ` +
                `appear in a JavaScript identifier replaced by \`_\`.`
        );
    }

    claimed.set(generatedKey(root, name), path);
    if (path.endsWith('.py')) claimPython(path, root);

    return name;
};

// The name Python imports a `.py` by, claimed under the same rule. Its stem:
// `a/config.py` and `b/config.py` are both `config`, and `import config` cannot
// say which directory it means, so the second is refused. Here rather than in
// the browser, which cannot tell a rename from a second file: the renamed store
// registers before the old one is gone.
//
// A stem no `import` can write, `+page.server` for every route of that kind, is
// never looked up, and never claimed.
const pythonClaimed = (globalThis[Symbol.for('svelthon.pythonClaimed')] ??= new Map());
const IMPORTABLE = PY_NAME;

function claimPython(path, root) {
    const name = pythonModuleName(path);
    if (!IMPORTABLE.test(name)) return;

    const first = pythonClaimed.get(generatedKey(root, name));

    if (first !== undefined && first !== path && stillClaims(resolve(root, first))) {
        throw new SyntaxError(
            `svelthon — \`${path}\` and \`${first}\` are both imported as \`${name}\`, ` +
                `so one would silently replace the other. Rename one of them: a module's ` +
                `Python name is its file name, and \`import ${name}\` cannot say which ` +
                `directory it means.`
        );
    }

    pythonClaimed.set(generatedKey(root, name), path);
}

// Whether a file still compiles to the name it claimed: a file, a module of
// Python or a component still written in it.
const stillClaims = (file) => isFile(file) && (file.endsWith('.py') || pythonFile(file));

// The tag that decides a file is Python is read by `pythonScript`, in markup.js,
// off the real script blocks and their real attributes, the same grammar that
// pass uses to know what *not* to rewrite. One reading, because the `script`
// hook below has a reading of its own that it cannot be talked out of
// (`attributes.lang`), and the two have to agree on every file.

// HTML allows whitespace before the `>` of a closing tag, and Svelte's parser
// reads it (its own fixture is named `whitespace-after-style-tag`). Svelte's
// *preprocessor* does not: its pattern ends in `<\/script>`, with no room for a
// space, so a block closed that way is never handed to any script hook while the
// compiler accepts the file anyway.
//
// The two halves then disagree about one file. The markup is compiled for
// Python, `{len(xs)}` becomes a call into the generated module, and the
// `<script>` reaches Svelte as it stands, where `xs = [1, 2]` parses as
// JavaScript and declares nothing. What the author sees is `xs is not defined`,
// about a name they wrote.
//
// Refused here, where both facts are known. The rule this project already holds
// is that a construct it cannot handle is refused rather than passed through as
// JavaScript, and this is one: the cause is upstream, the silence would be ours.
function refuseSpacedClose(closing, filename, root) {
    if (closing === '</script>') return;

    throw new SyntaxError(
        `svelthon — the Python \`<script>\` is closed with \`${closing}\`, and Svelte's ` +
            `preprocessor only recognises \`</script>\`: the block never reaches it, so the ` +
            `Python is handed to the compiler as JavaScript and every name it declares is ` +
            `missing at run time. Close it with \`</script>\` ` +
            `(${shownPath(filename, root)})`
    );
}

// A Python script inside an element or a block, which Svelte reads as an element
// of the page and not as the component's script: the markup would stay
// JavaScript, and its first expression only Python can run would fail at run
// time, far from the cause. An element whose closing tag is omitted counts, so
// a `<p>` left open before the script is named.
function refuseStrayPython(content, filename, root) {
    const at = strayPythonScript(content);

    if (at === -1) return;

    throw new SyntaxError(
        `svelthon — this \`<script lang="python">\` stands inside an element or a block, ` +
            `where Svelte reads it as an element of the page and not as the component's ` +
            `script, so the markup would stay JavaScript. Move it to the top level of the ` +
            `file, outside every element and every block; an element whose closing tag is ` +
            `left out, such as a \`<p>\`, is still open ` +
            `(${shownPath(filename, root)}:${content.slice(0, at).split('\n').length})`
    );
}

// Names a component imports or declares in its `<script module>`. They live in
// JavaScript, and Python cannot import them, but they are in scope for the
// generated code, so publishing them into the namespace makes them readable
// from Python. That is what lets a Python component reach `page` from
// `$app/state`, or any npm library at all.
//
// **Read from Svelte's parse, not from the text.** A regular expression over the
// block would take a commented-out or quoted import for a binding, read one name
// per declaration where `const first = 1, second = 2` binds two, and see nothing
// in a destructuring.
//
// JavaScript is Svelte's grammar here, not ours, and this runs inside a Svelte
// build by definition. The block is parsed alone, wrapped in a component with
// no template, because the real one is still Python at this point and Svelte
// would refuse it.
const declaredBy = (pattern) => {
    if (pattern === null) return [];

    switch (pattern.type) {
        case 'Identifier':
            return [pattern.name];
        case 'ObjectPattern':
            return pattern.properties.flatMap((one) =>
                declaredBy(one.type === 'RestElement' ? one.argument : one.value)
            );
        case 'ArrayPattern':
            return pattern.elements.flatMap(declaredBy);
        case 'AssignmentPattern':
            return declaredBy(pattern.left);
        case 'RestElement':
            return declaredBy(pattern.argument);
        default:
            return [];
    }
};

// A TypeScript `import type`, `export type` or `declare`, which names a type or
// an ambient value: no code at run time holds it, at the top of the module or
// in a namespace.
const erased = (node) => node.declare || node.importKind === 'type' || node.exportKind === 'type';

// Whether a TypeScript namespace holds a value, which the transform then binds
// to its name: one that declares only types, an interface, a type alias, what
// is erased or a namespace of the same kind, is erased with them.
const TYPES_ONLY = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration']);

const instantiated = (node) => {
    const body = node.body?.type === 'TSModuleDeclaration' ? [node.body] : (node.body?.body ?? []);

    return body.some((one) => {
        const declared = one.type === 'ExportNamedDeclaration' && one.declaration ? one.declaration : one;

        if (erased(one) || erased(declared)) return false;
        if (declared.type === 'TSModuleDeclaration') return instantiated(declared);
        return !TYPES_ONLY.has(declared.type);
    });
};

// The specifiers of an import that bind a value at run time: an `import type`,
// or a specifier written `type`, names a type, which the transform erases.
const valueSpecifiers = (node) =>
    node.importKind === 'type' ? [] : node.specifiers.filter((one) => one.importKind !== 'type');

// The names a statement at the top of the module binds there, at run time. What
// is erased binds nothing. An `enum`, a namespace that holds a value and an
// `import X = A.B` are values the transform binds; a namespace's `var` stays in
// the function it becomes.
const declares = (node) => {
    if (erased(node)) return [];

    switch (node.type) {
        case 'ImportDeclaration':
            return valueSpecifiers(node).map((one) => one.local.name);
        case 'VariableDeclaration':
            return node.declarations.flatMap((one) => declaredBy(one.id));
        case 'FunctionDeclaration':
        case 'ClassDeclaration':
        case 'TSEnumDeclaration':
        case 'TSImportEqualsDeclaration':
            return declaredBy(node.id);
        case 'TSModuleDeclaration':
            return instantiated(node) ? declaredBy(node.id) : [];
        // `export const shared = 1` is a declaration wearing a hat. A bare
        // `export { a }` re-exports a name already declared above, so it adds
        // nothing and falls through.
        case 'ExportNamedDeclaration':
        case 'ExportDefaultDeclaration':
            return node.declaration ? declares(node.declaration) : [];
        default:
            return [];
    }
};

// What JavaScript scopes to the module from below the top: a `var`, in a block,
// a loop or a `try`. `let`, `const`, a class, and in a module a function declared
// in a block, belong to the block; a function's body is a scope of its own, and
// so is a TypeScript namespace, which the transform makes a function.
const SCOPES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'ClassDeclaration',
    'ClassExpression',
    'TSModuleDeclaration'
]);
const POSITIONS = new Set(['type', 'start', 'end', 'loc', 'range', 'metadata']);

const hoisted = (node, found = []) => {
    if (node === null || typeof node !== 'object') return found;
    if (Array.isArray(node)) {
        for (const one of node) hoisted(one, found);
        return found;
    }
    if (SCOPES.has(node.type)) return found;
    if (node.type === 'VariableDeclaration' && node.kind === 'var' && !node.declare) {
        found.push(...node.declarations.flatMap((one) => declaredBy(one.id)));
    }
    for (const [key, value] of Object.entries(node)) if (!POSITIONS.has(key)) hoisted(value, found);
    return found;
};

// The statements of the `<script module>`, or none.
const moduleBody = (content) => {
    const block = moduleScript(content);

    if (block === null) return [];

    try {
        // The element as written, so `lang="ts"` parses its annotations.
        return parse(block, { modern: true }).module?.content?.body ?? [];
    } catch {
        // A block that does not parse is one Svelte is about to refuse itself,
        // naming the line. Publishing nothing leaves that message as the only
        // one the author sees, rather than ours in front of it.
        return [];
    }
};

// The components the `<script module>` imports by default from a `.svelte`
// file, `import Child from "./Child.svelte"` or `import { default as Child }
// from …`: what each local name is, and where it comes from. The other half of
// `componentImports`, which reads the same of `importjs`. A type imported so
// is no component: the name it gives holds nothing at run time, and the
// instance may be handed a component of the other language under it, whose
// props then crossed as the type's file said.
const defaultImport = (one) =>
    one.type === 'ImportDefaultSpecifier' ||
    (one.type === 'ImportSpecifier' && (one.imported.name ?? one.imported.value) === 'default');

const moduleComponents = (content) =>
    moduleBody(content)
        .filter((node) => node.type === 'ImportDeclaration' && importedFile(String(node.source.value)).endsWith('.svelte'))
        .flatMap((node) =>
            valueSpecifiers(node)
                .filter(defaultImport)
                .map((one) => ({ local: one.local.name, from: String(node.source.value) }))
        );

export function moduleImports(content) {
    const body = moduleBody(content);

    return [...new Set([...body.flatMap(declares), ...hoisted(body)])];
}

// A component that declares a custom element has to be *compiled* as one.
// Svelte reads the declaration and compiles an ordinary component anyway unless
// the option is set, saying so on every build: *the customElement option is
// used when generating a custom element. Did you forget the customElement: true
// compile option?*
//
// Read off the declaration rather than set globally, because `customElement:
// true` turns every component into one. Exported because two readers need the
// same rule: the config hands it to vite-plugin-svelte's
// `dynamicCompileOptions`, and the guard that compiles every fixture looking
// for warnings has to compile them the way the build does.
//
// Read on the markup alone, like every other reading of an option: a
// declaration quoted in `<!-- -->` is documentation, and one in a script's
// string is the author's text.
//
// Each language by its own rules. Markup whose expressions are JavaScript, a
// JavaScript component and what the preprocessor makes of a Python one, is
// read by Svelte's parser, which knows a tag from the text of an expression,
// a `/* } */` or a nested template literal among it. Markup whose expressions
// are Python does not parse as JavaScript, and is read by the scanner made for
// it (`markupOnly`).
//
// Only where a `<svelte:options>` is written at all, which nothing else can
// declare: the parse reads every expression of the component, each from a
// count of the lines before it, and was the larger half of a markup pass grown
// with the square of its expressions.
//
// `customElement={null}` declares nothing: Svelte's parser skips it, as an
// option Svelte 3 asked for, and compiled as an element, a component no global
// option makes one was one. Quoted as well, `"{null}"`, which Svelte reads the
// same, and which was taken for a tag, an empty one Svelte refused.
const NULL_ELEMENT = /\bcustomElement\s*=\s*(["']?)\{\s*null\s*\}\1/;
const isNullTag = (one) => one?.expression?.type === 'Literal' && one.expression.value === null;
const isNull = (value) => isNullTag(value) || (Array.isArray(value) && value.length === 1 && value[0].type === 'ExpressionTag' && isNullTag(value[0]));

export const compileOptionsFor = (code) => {
    let declared;

    if (!code.includes('<svelte:options')) return undefined;

    try {
        declared = parse(blankBodies(withoutComments(code)), { modern: true }).options?.attributes.some(
            (one) => one.name === 'customElement' && !isNull(one.value)
        );
    } catch {
        // The tag found where its expressions are blanked, and its value read
        // at the same offsets where they are not.
        const tag = /<svelte:options[^>]*\bcustomElement\b[^>]*>/.exec(markupOnly(code));
        const written = tag && blankBodies(withoutComments(code)).slice(tag.index, tag.index + tag[0].length);

        declared = tag !== null && !NULL_ELEMENT.test(written);
    }

    return declared ? { customElement: true } : undefined;
};

// What the `markup` hook works out about a file and the `script` hook then needs:
//
// - `lineOffset`: Python line numbers count from the start of the <script> body
//   and the file counts from its first line. The gap is the number of lines
//   before the end of the opening tag.
// - `defs`: the hidden functions the markup needs, appended to its Python.
// - `jsNames`: what the file imports from JavaScript.
// - `element`: whether the file declares itself a custom element.
//
// One entry per call of Svelte's `preprocess()`, not per file: two calls on two
// versions of one file can run at once, both `markup` hooks before either
// `script` hook, and each `script` hook needs the expressions of its own
// version. The `markup` hook writes the entry's key on the Python `<script>`
// tag as the attribute below, which Svelte hands to the `script` hook with the
// others, and the `script` hook takes the attribute off.
//
// Held inside `python()` and not at module scope. Both hooks live on the object
// it returns, so they have no reason to be shared by every preprocessor a
// process constructs.
//
// `generated` and `claimed` above are the opposite case and stay global: the
// preprocessor and the plugin are not always the same module instance.
const CALL = 'svelthon-call';

const perCall = () => {
    const calls = new Map();
    let last = 0;

    return {
        open(about) {
            last += 1;
            calls.set(String(last), about);
            return String(last);
        },
        // The `script` hook without the `markup` hook before it has no entry, and
        // the markup then needs nothing from it.
        take(key) {
            const about = calls.get(key) ?? { lineOffset: 0, defs: [], jsNames: [] };
            calls.delete(key);
            return about;
        }
    };
};

// `<script` and the attribute naming the call, on the tag `pythonScript` finds.
function tagged(code, key) {
    const at = pythonScript(code).index + '<script'.length;

    return `${code.slice(0, at)} ${CALL}="${key}"${code.slice(at)}`;
}

// The Svelte preprocessor: runs before Svelte parses the component, so the
// compiler only ever sees ordinary JavaScript with runes.
// `path` mirrors PYTHONPATH: the directories searched for the `.py` a component
// imports, after its own. Without it, `import counter_store` only ever resolves
// to a sibling file, and a component that reached the module some other way
// would appear to work purely by load order.
//
// A component written in Python says so when its module loads, before any
// parent hands it a prop: a parent that holds it rather than imports it, by a
// prop, a snippet's parameter or `<svelte:component>`, hands each prop to
// `__brycomp_pybridge.child`, which asks, and a server prepares the props before the
// component's own script runs. It names itself through its own module, which is
// the identity every importer holds, handed as a function read when a parent
// asks, since Svelte sets `export default` last when it wraps the component for
// hot reload. Said in the `<script module>`, at its start, or in one of its own
// after the file's last line, so nothing the author wrote moves.
//
// The module is the one asked for, `./Child.svelte?variant=one` a module and a
// component of its own: its import of itself names no file, and the plugin
// resolves it to the module that imports it (`SELF`). By its file, the one
// without the query announced itself, and a parent took the other for a
// JavaScript child, which it handed JavaScript's values.
const SELF = 'virtual:svelthon-self';

// What this pass says in the `<script module>`, in one insertion, so the script
// is looked for once: at its start, on its first line, so nothing the author
// wrote moves, and in one of its own after the file's last line when the
// component has none.
const inModuleScript = (code, statement) => {
    const at = moduleScriptStart(code);

    return at === -1 ? `${code}<script module>${statement}</script>` : code.slice(0, at) + statement + code.slice(at);
};

const announcement = (filename) =>
    filename
        ? `import __brycomp_svelthon_self from ${JSON.stringify(SELF)};` +
          `import { __brycomp_pybridge as __brycomp_svelthon_bridge } from 'svelthon/bridge';` +
          `__brycomp_svelthon_bridge.python(() => __brycomp_svelthon_self);`
        : '';

// The getters of the names the `<script module>` binds, in that script's own
// scope, which Python reads them through (`MODULE_READERS`): the instance
// script is a scope inside it, where the compiler declares names of its own,
// and a bare read of the module's name found the instance's first.
const moduleReaders = (names, held) =>
    names.length === 0
        ? ''
        : `const ${MODULE_READERS} = { ${names.map((name) => `get ${JSON.stringify(name)}() { return ${held.get(name) ?? name}; }`).join(', ')} };`;

// A rune's name the `<script module>` binds at its top, `export const derived
// = …`, is held under another variable: Svelte reads `$derived` as a store once
// the component binds `derived`, and every `$derived` Svelthon writes for the
// author stopped the compile (`store_invalid_subscription`). The export keeps
// its name, and Python reads the variable (`moduleReaders`). A variable the
// script's text names nowhere: `__brycomp_svelthon_state` declared in a function of the
// author's took there the reads of the module's `state`.
const heldRunes = (code, names) => {
    const named = new Set(moduleScript(code)?.match(/[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*/gu));

    return new Map(
        names
            .filter((name) => RUNES.includes(name))
            .map((name) => {
                let held = `__brycomp_svelthon_${name}`;

                while (named.has(held)) held += '_';

                return [name, held];
            })
    );
};

const TYPE_KEYS = new Set(['typeAnnotation', 'returnType', 'typeParameters', 'typeArguments', 'superTypeParameters', 'implements']);

// What a scope declares of its own: a function's parameters and the name of a
// function or class expression; the `let`, `const`, class and function of a
// block, and with a function's body its `var`s; a `for`'s and a `catch`'s.
const ownNames = (node, functionBody) => {
    switch (node.type) {
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
            return [...node.params.flatMap(declaredBy), ...(node.type === 'FunctionExpression' && node.id ? [node.id.name] : [])];
        case 'ClassExpression':
            return node.id ? [node.id.name] : [];
        case 'CatchClause':
            return node.param ? declaredBy(node.param) : [];
        case 'ForStatement':
        case 'ForInStatement':
        case 'ForOfStatement': {
            const init = node.type === 'ForStatement' ? node.init : node.left;

            return init?.type === 'VariableDeclaration' && init.kind !== 'var' ? init.declarations.flatMap((one) => declaredBy(one.id)) : [];
        }
        case 'BlockStatement':
        case 'StaticBlock':
        case 'SwitchStatement': {
            const body = node.type === 'SwitchStatement' ? node.cases.flatMap((one) => one.consequent) : node.body;

            return [
                ...body.flatMap((one) => (one.type === 'VariableDeclaration' && one.kind === 'var' ? [] : declares(one))),
                ...(functionBody ? hoisted(body) : [])
            ];
        }
        default:
            return [];
    }
};

// The component with its `<script module>`'s rune names held (`heldRunes`):
// the binding and each read of it that no inner scope shadows, an import or an
// export by name keeping the name it imports or exports.
function holdRunes(code, aliases) {
    const bound = [...aliases.keys()];
    // A name beside a rune's in one declaration keeps its own: written
    // `undefined as caption`, the export was refused (`export_undefined`).
    const heldRune = (name) => aliases.get(name) ?? name;

    if (bound.length === 0) return code;

    const at = moduleScriptIndex(code);
    const source = moduleScript(code);
    const program = parse(source, { modern: true }).module.content;
    const edits = [];
    const held = (node, shadowed) => node.type === 'Identifier' && bound.includes(node.name) && !shadowed.has(node.name);
    const rename = (node) => edits.push([node.start, node.end, heldRune(node.name)]);
    const renamedAs = (node, outside) => edits.push([node.start, node.end, `${outside}${heldRune(node.name)}`]);
    // A function or a class with no name of its own, evaluated for a binding
    // held under another variable: named there after the binding as written,
    // by the bridge, which hands it back. Behind its statement, an assignment
    // left it `__brycomp_svelthon_state`, and a default of a pattern as well. And one
    // behind what TypeScript erases, `(() => 1) as Handler`, named once erased.
    const namedHere = (id, value) => {
        let made = value;

        while (ERASED_AROUND.has(made?.type)) made = made.expression;
        if (!ANONYMOUS.has(made?.type) || made.id) return;
        if (made.type === 'ClassExpression') namedFirst(made, id.name);
        else edits.push([value.start, value.start, `${HOOKS_NAME}.named(`], [value.end, value.end, `, ${JSON.stringify(id.name)})`]);
    };
    // A class named in a first static block, as JavaScript names it before
    // any of its own: behind it, a static field or block that read `this.name`
    // read `__brycomp_svelthon_state`, and a `static ['name']` was written over.
    const namedFirst = (node, name) =>
        edits.push([node.body.start + 1, node.body.start + 1, `static { ${HOOKS_NAME}.named(this, ${JSON.stringify(name)}); }`]);

    const visit = (node, shadowed, functionBody = false) => {
        if (node === null || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            for (const one of node) visit(one, shadowed);
            return;
        }
        if (typeof node.type !== 'string') return;

        const outer = shadowed;
        const own = ownNames(node, functionBody).filter((name) => bound.includes(name));

        if (own.length > 0) shadowed = new Set([...shadowed, ...own]);

        switch (node.type) {
            case 'Identifier':
                if (held(node, shadowed)) rename(node);
                return;
            // What a `switch` tests is read outside the scope its cases make.
            case 'SwitchStatement':
                visit(node.discriminant, outer);
                visit(node.cases, shadowed);
                return;
            case 'ImportSpecifier':
                if (held(node.local, shadowed)) {
                    if (node.imported.start === node.local.start) renamedAs(node.local, `${node.local.name} as `);
                    else rename(node.local);
                }
                return;
            case 'ExportSpecifier':
                if (held(node.local, shadowed)) {
                    if (node.exported.start === node.local.start) edits.push([node.local.start, node.local.end, `${heldRune(node.local.name)} as ${node.local.name}`]);
                    else rename(node.local);
                }
                return;
            // What TypeScript makes a value of binds its name as a variable
            // does, `enum state` and a namespace `derived`, and reads the
            // module's names: an enum's members by their own names, a
            // namespace's body as a function's, its names its own, a dotted
            // name's inner part a member of the outer. The skip below kept
            // the declared name as written where its export and its reads
            // were held. What the transform erases binds nothing.
            case 'TSEnumDeclaration': {
                if (erased(node)) return;
                if (held(node.id, shadowed)) rename(node.id);

                const members = new Set([...shadowed, ...node.members.map((one) => one.id.name ?? one.id.value)]);

                for (const member of node.members) visit(member.initializer, members);
                return;
            }
            case 'TSModuleDeclaration':
                if (erased(node) || !instantiated(node)) return;
                if (held(node.id, shadowed)) rename(node.id);
                namespaceBody(node.body, shadowed);
                return;
            case 'TSImportEqualsDeclaration': {
                if (erased(node)) return;

                let reference = node.moduleReference;

                while (reference.type === 'TSQualifiedName') reference = reference.left;
                visit(reference, shadowed);
                if (!held(node.id, shadowed)) return;
                rename(node.id);
                // `export import`, as the export of a declaration is said.
                if (node.isExport) {
                    edits.push(
                        [node.start, node.start + source.slice(node.start).indexOf('import'), ''],
                        [node.end, node.end, `;export { ${heldRune(node.id.name)} as ${node.id.name} };`]
                    );
                }
                return;
            }
            case 'ExportAllDeclaration':
                return;
            case 'ExportNamedDeclaration':
                if (node.source) return;
                // The export said again right behind its declaration, on its
                // line: at the end of the script, it joined a last statement
                // written with no `;`, or a comment that ends it. Not a
                // namespace's own, whose names are its own.
                if (node.declaration && declares(node.declaration).some((name) => bound.includes(name) && !shadowed.has(name))) {
                    const names = declares(node.declaration).map((name) => `${heldRune(name)} as ${name}`);

                    edits.push([node.start, node.declaration.start, ''], [node.end, node.end, `;export { ${names.join(', ')} };`]);
                }
                break;
            case 'Property':
                if (node.shorthand && !node.computed && held(node.key, shadowed)) {
                    renamedAs(node.key, `${node.key.name}: `);
                    if (node.value.type === 'AssignmentPattern') {
                        namedHere(node.key, node.value.right);
                        visit(node.value.right, shadowed);
                    }
                    return;
                }
                break;
            // Where JavaScript names a function or a class after the binding
            // it is evaluated for, which `.name` reads: a declaration, an
            // assignment, a logical one, a default of a pattern (`namedHere`).
            case 'VariableDeclarator':
                if (held(node.id, shadowed)) namedHere(node.id, node.init);
                break;
            case 'AssignmentExpression':
                if (NAMING.has(node.operator) && held(node.left, shadowed)) namedHere(node.left, node.right);
                break;
            case 'AssignmentPattern':
                if (held(node.left, shadowed)) namedHere(node.left, node.right);
                break;
            case 'LabeledStatement':
            case 'BreakStatement':
            case 'ContinueStatement':
                visit(node.body, shadowed);
                return;
        }

        for (const [key, value] of Object.entries(node)) {
            if (POSITIONS.has(key) || TYPE_KEYS.has(key)) continue;
            if (node.type.startsWith('TS') && key !== 'expression') continue;
            if (key === 'property' && node.type === 'MemberExpression' && !node.computed) continue;
            if (key === 'key' && !node.computed) continue;
            visit(value, shadowed, key === 'body' && FUNCTIONS.has(node.type));
        }
    };

    // A namespace's body, `namespace derived.inner { … }` the inner one's.
    const namespaceBody = (body, shadowed) => {
        if (body?.type === 'TSModuleDeclaration') return namespaceBody(body.body, shadowed);
        if (body?.type !== 'TSModuleBlock') return;

        const own = [...body.body.flatMap(declares), ...hoisted(body.body)].filter((name) => bound.includes(name));

        visit(body.body, new Set([...shadowed, ...own]));
    };

    visit(program, new Set());

    // And the name JavaScript gives a function or a class after the binding it
    // is declared under, which `.name` reads: `class state` was named
    // `__brycomp_svelthon_state`, and a registry keyed by it missed it. A function's
    // given back at the top, where it is hoisted to, a class's in its first
    // static block. By the bridge the module imports for its hooks, whose name
    // is the plugin's, and which leaves a name the author's code gave
    // (`named`).
    for (const statement of program.body) {
        const declaration = /^Export(Named|Default)Declaration$/.test(statement.type) ? statement.declaration : statement;

        if (declaration === null || erased(declaration)) continue;
        if (!/^(Function|Class)Declaration$/.test(declaration.type) || !declaration.id || !bound.includes(declaration.id.name)) continue;

        const { name } = declaration.id;

        if (declaration.type === 'ClassDeclaration') namedFirst(declaration, name);
        else edits.push([program.start, program.start, `${HOOKS_NAME}.named(${heldRune(name)}, ${JSON.stringify(name)});`]);
    }

    let text = code;

    for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) {
        text = text.slice(0, at + start) + replacement + text.slice(at + end);
    }

    return text;
}

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

// What takes its name from the binding it is first assigned to, and the
// assignments that name it.
const ANONYMOUS = new Set(['FunctionExpression', 'ArrowFunctionExpression', 'ClassExpression']);
const NAMING = new Set(['=', '&&=', '||=', '??=']);
const ERASED_AROUND = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion']);

// The questions the runtime asks of Svelte (`bridgeHooks`), laid down in the
// `<script module>`, once, in a scope that holds no instance's data: laid down
// by each instance, they were functions of its scope, which the runtime keeps,
// and the last instance's props stayed alive once it was unmounted.
const HOOKS_NAME = '__brycomp_svelthon_hooks';
const HOOKS = `import { __brycomp_pybridge as ${HOOKS_NAME} } from 'svelthon/bridge';` + bridgeHooks(HOOKS_NAME).join('');

// Whether a component's own file is written in Python.
const pythonFile = (path) => pythonScript(readFileSync(path, 'utf8')) !== null;

// Whether each component was last compiled as Python or as JavaScript, by a
// pass that compiled it: what the page runs. A refused pass leaves the language
// before it. On the global registry, as `COMPILED_FROM` is.
const LAST_LANGUAGE = (globalThis[Symbol.for('svelthon.lastLanguage')] ??= new Map());

// Whether an edit changed the language of a component the page runs. One never
// compiled, as one the page never loaded, changed none, and one refused then
// repaired is in the language it was.
const relanguages = (file) => {
    if (!LAST_LANGUAGE.has(file)) return false;

    try {
        return pythonFile(file) !== LAST_LANGUAGE.get(file);
    } catch {
        return false;
    }
};

// What a component was last compiled from: its source, the language of each
// child whose file it read, and what each module its script imports was found
// as, the file the prelude evaluates and the refusal of one that is missing.
// The dev server changes a component whose child changed language, or whose
// modules are found elsewhere (`configureServer`). On the global registry, as
// `generated` is: the preprocessor records, the plugin asks, and they are not
// always one instance of this module.
//
// The modules as stores have them (`compilePython`): a module moved from beside
// the component to the path, or one of the path that a file beside it now
// shadows, is found elsewhere, and the prelude of the code compiled before
// named a file that is no longer the one Python imports.
const COMPILED_FROM = (globalThis[Symbol.for('svelthon.compiledFrom')] ??= new Map());

// The modules missing for which a component or module of Python was last
// refused: a file of one of those names created asks it again
// (`configureServer`), as Vite asks again an importer whose import it could not
// resolve. A refused compile records nothing in `COMPILED_FROM` nor in
// `compiledStores`, and the page kept the overlay until it was reloaded. On the
// global registry, as `COMPILED_FROM` is.
const REFUSED_IMPORTS = (globalThis[Symbol.for('svelthon.refusedImports')] ??= new Map());

const refusedFor = (file, missing, compiling) => {
    REFUSED_IMPORTS.delete(file);

    try {
        return compiling();
    } catch (error) {
        if (file !== undefined && missing.length > 0) REFUSED_IMPORTS.set(file, missing);
        throw error;
    }
};

// What `resolves` answers, a name found as no file kept as missing.
const kindNoted = (kind, mod, missing) => {
    if (kind !== 'file') missing.push(mod);
    return kind;
};

// The watchers of the dev servers that watch the children a component reads for
// their language (`configureServer`), while they watch: a server closed, a
// build that watches, each child is a dependency of its parent, which a change
// of it compiles again. On the global registry, as `COMPILED_FROM` is.
const WATCHED_CHILDREN = (globalThis[Symbol.for('svelthon.watchedChildren')] ??= new Set());

const childrenWatched = () => {
    for (const watcher of WATCHED_CHILDREN) {
        if (watcher.closed !== false) WATCHED_CHILDREN.delete(watcher);
    }

    return WATCHED_CHILDREN.size > 0;
};

const foundAs = (names, directory, path) =>
    names.map((mod) => `${moduleKind(mod, directory, path)} ${moduleFile(mod, directory, path) ?? ''}`).join('\n');

const compiledAsBefore = (file) => {
    const before = COMPILED_FROM.get(file);

    try {
        return (
            before?.imports !== undefined &&
            readFileSync(file, 'utf8') === before.content &&
            before.children.every(([path, python]) => existsSync(path) && pythonFile(path) === python) &&
            foundAs(before.imports.names, before.imports.directory, before.imports.searchPath) === before.imports.found
        );
    } catch {
        return false;
    }
};

// The one option of the preprocessor and of the plugin, `path: ['src/lib']`,
// the folders Python's imports are searched in, resolved against `root`. Any
// other name, a misspelt `paths` among them, and a `path` that is no list of
// strings are refused, as Svelte refuses an option it does not know, where the
// first was ignored in silence and the second raised a JavaScript error.
const searchPathOf = (options, root) => {
    // An object to begin with: `python(null)` raised a JavaScript error, and
    // `python('src/lib')` was told of an option `0`, the index of its first
    // letter. The folders a string or a list names are said as the option.
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
        const named = typeof options === 'string' ? [options] : Array.isArray(options) && options.every((one) => typeof one === 'string') ? options : ['src/lib'];

        throw new Error(`svelthon — the options are an object, as \`{ path: ${JSON.stringify(named).replaceAll('"', "'").replaceAll(',', ', ')} }\``);
    }

    for (const name of Object.keys(options)) {
        if (name !== 'path') {
            throw new Error(`svelthon — unknown option \`${name}\`: the one option is \`path\`, as \`path: ['src/lib']\``);
        }
    }

    if (options.path === undefined) return undefined;

    if (!Array.isArray(options.path) || options.path.some((one) => typeof one !== 'string')) {
        throw new Error("svelthon — `path` takes a list of folders, as `path: ['src/lib']`");
    }

    return options.path.map((one) => resolve(root, one));
};

export function python(options = {}) {
    const calls = perCall();

    // The project the modules it files belong to, read as it is made, as the
    // plugin reads its own: the directory the process is in when it later
    // preprocesses a component may be another project's.
    const root = process.cwd();

    // The project's too, `path: ['src/lib']` as the README writes it: resolved
    // now, so a component of this project imports this project's modules
    // whatever directory the process has moved to since.
    const searchPath = searchPathOf(options, root) ?? [];

    // Shared with the plugin, which compiles the `.py` files themselves and has
    // to resolve their imports the same way. The two halves may not be the same
    // module instance, so a value on the global is the only channel between
    // them. See the registry above.
    //
    // This preprocessor does not read it: it passes `searchPath` to the
    // resolution itself, so a second `python(options)` built afterwards cannot
    // change what this one resolves. What is left on the global is the fallback
    // for the plugin alone, which has no way of telling configurations apart;
    // `svelthon({ path })` is how to say so explicitly when there are two.
    globalThis[Symbol.for('svelthon.path')] = searchPath;

    return {
        name: 'svelthon',
        markup({ content, filename }) {
            // The template language follows the script language, with no third
            // mode: a component without `lang="python"` is a JavaScript
            // component and stays one, exactly as a .js file is untouched by
            // TypeScript. Python semantics are opt-in, per file, by declaring
            // Python, never injected behind an author's back.
            const declaring = pythonScript(content);

            // Known as compiled once this pass has compiled it, and as nothing
            // when it is JavaScript, or refused.
            COMPILED_FROM.delete(filename);
            REFUSED_IMPORTS.delete(filename);

            if (declaring === null) {
                refuseStrayPython(content, filename, root);
                if (filename) LAST_LANGUAGE.set(filename, false);
                return;
            }

            refuseSpacedClose(declaring.closing, filename, root);

            // The body starts after the tag's `>`, which a tag written over two
            // lines puts on the second line, and which a quoted value may hold
            // before it.
            const open = declaring.body;

            const file = {
                // The whole file as it was handed over, which may be in memory
                // only, or differ from what the disk holds: a debugger opens it.
                sourceContent: content,
                jsNames: moduleImports(content),
                element: compileOptionsFor(content) !== undefined,
                lineOffset: content.slice(0, open).split('\n').length - 1,
                defs: [],
                defLines: [],
                defColumns: [],
                defTexts: []
            };

            // The collector itself is in markup.js, which the browser can load.
            const collect = collector(file.defs, file.defLines, file.defColumns, file.defTexts);

            const python = content.slice(open, declaring.end);

            // The children whose language their own file tells: a prop handed
            // to one written in Python is the Python value itself, a
            // `Price(float)` with its class, where a JavaScript child is handed
            // JavaScript's number. A `.svelte` file imported by `importjs` or in
            // the `<script module>`, the way the README writes a composition.
            // Any other child, one a package, a module that re-exports it or a
            // namespace gives, or one the script assigned, is told apart when it
            // is mounted, and so is one imported with a query: a plugin may make
            // it another language than its file. A child that changes language
            // compiles this one again: the dev server asks it when it does
            // (`WATCHED_CHILDREN`), and a build that watches takes each file
            // read for a dependency.
            const languages = [];
            const pythonChildren = new Set();
            const javascriptChildren = new Set();

            for (const { local, from } of [...componentImports(python, filename ?? 'component'), ...moduleComponents(content)]) {
                if (!filename || !from.startsWith('.') || /[?#]/.test(from)) continue;

                const path = resolve(dirname(filename), importedFile(from));

                if (!existsSync(path)) continue;

                const written = pythonFile(path);

                languages.push([path, written]);
                (written ? pythonChildren : javascriptChildren).add(local);
            }

            const imported = new Set([...importedNames(python, filename ?? 'component'), ...moduleImports(content)]);

            // Whether a name of the script runs code when it is read, a derived
            // or a prop: read once, and only by an expression that may be
            // handed a name ahead. Every name, of a script that does not parse.
            let running;
            const runs = (name) => {
                if (running === undefined) {
                    const declared = scriptSurface(python, moduleImports(content));

                    running = declared === null ? null : runningNames(declared);
                }

                return running === null || running.includes(name);
            };

            // And what each stretch of the markup became (`marks`).
            const marks = [];
            const code = overMarkup(
                content,
                // The markup, and where it starts, so a refusal can name a
                // line and a column in the file the author is looking at.
                (markup, offset) =>
                    pythonExpressions(markup, collect, undefined, {
                        filename,
                        content,
                        offset,
                        pythonChildren,
                        javascriptChildren,
                        imported,
                        runs,
                        marks
                    })
            );

            // And whether it holds a child it does not import, which the page
            // tells Python's or JavaScript's as it runs (`relanguaged`).
            if (filename) COMPILED_FROM.set(filename, { content, children: languages, holding: code.includes('__brycomp_pybridge.child(') });

            // The expressions whose flag the markup reads, which the script
            // declares (`unmemoized`).
            file.rereads = [...new Set(Array.from(code.matchAll(/\b__brycomp_expr_reread\.(__brycomp_expr_\w+)\b/g), (found) => found[1]))];

            const held = heldRunes(code, file.jsNames);
            const emitted = inModuleScript(
                tagged(elementOptions(holdRunes(code, held), python, file.jsNames), calls.open(file)),
                announcement(filename) + HOOKS + moduleReaders(file.jsNames, held)
            );

            // And what it was written and emitted as, which a warning its
            // compile makes is placed by (`placeWarning`).
            if (filename) keepWritten(filename, file, { written: content, emitted, code, marks });

            return { code: emitted, dependencies: childrenWatched() ? [] : languages.map(([path]) => path) };
        },
        script({ content, attributes, filename }) {
            // Read as `pythonScript` reads the tag, by names in any case: Svelte
            // hands them over as written, and the two passes have to agree that
            // `<script LANG="python">` is Python.
            const named = (wanted) => Object.keys(attributes).find((key) => key.toLowerCase() === wanted);
            const langKey = named('lang');

            if (langKey === undefined || attributes[langKey] !== 'python') return;

            const { [langKey]: lang, [CALL]: call, ...rest } = attributes;
            const about = calls.take(call);

            // One component, one generated module: this hook fires once per
            // script block and both derive their id from `nameFor(filename)`,
            // so two Python blocks claim one entry of `generated`.
            //
            // State shared by every instance is what a `.svelte.py` module is,
            // and it is a file any component can import, so the refusal names
            // it rather than only complaining.
            //
            // Both spellings, because Svelte 5 still parses the Svelte 4 one:
            // `<script module>` gives `module: true`, `<script
            // context="module">` gives `context: 'module'`.
            if (attributes[named('module')] || attributes[named('context')] === 'module') {
                throw new SyntaxError(
                    `svelthon — a <script module> cannot hold Python; state shared ` +
                        `by every instance belongs in a .svelte.py module, which a ` +
                        `component imports like any other ` +
                        `(${shownPath(filename, root)})`
                );
            }

            // Its own directory, where its imports are looked for first, and the
            // project's for a component handed over without a file.
            const directory = filename ? dirname(filename) : root;

            // Known as compiled once the script has compiled too, with what its
            // imports were found as (`compiledAsBefore`).
            const record = filename === undefined ? undefined : COMPILED_FROM.get(filename);
            const asked = [];

            if (record !== undefined) COMPILED_FROM.delete(filename);

            const name = nameFor(filename, root);
            const body = bodyId(root, name, content, about);
            const missing = [];
            const { script, module, map, imports } = refusedFor(filename, missing, () =>
                compile(content, name, shownPath(filename, root), {
                    // The block alone when no markup pass came first; the whole
                    // file the markup pass was handed when one did (`about`).
                    sourceContent: content,
                    ...about,
                    resolves: (mod) => {
                        asked.push(mod);
                        return kindNoted(moduleKind(mod, directory, searchPath), mod, missing);
                    },
                    body
                })
            );

            if (record !== undefined) {
                const names = [...new Set([...asked, ...imports])];

                COMPILED_FROM.set(filename, { ...record, imports: { names, directory, searchPath, found: foundAs(names, directory, searchPath) } });
                LAST_LANGUAGE.set(filename, true);
            }

            // `import counter_store` in a component resolves to a .py file, its
            // own directory first, then `path`. The module's code has to be
            // evaluated before init() runs, so the import statement finds it;
            // its body runs at that statement (`pythonImports`).
            const prelude = pythonImports(imports, directory, searchPath);

            // With the numbering its number is of, which a change of the file
            // hands out again (`forgotten`, `load`).
            const own = generatedKey(root, virtualId(name));

            generated.set(generatedKey(root, body), { ...withPrelude(module, map, prelude), own, numbering: slots.get(own) });

            // The content is JavaScript now, so the tag must stop claiming
            // otherwise. Leaving `lang="python"` in place is invisible to the
            // Svelte compiler, which parses the content as JavaScript either
            // way, but every tool downstream reads the attribute and refuses:
            // `svelte-check`, installed by 93% of SvelteKit projects, would
            // report dozens of parse errors per component.
            const code = sameLines(script, content);
            const kept = KEPT_FOR.get(about);

            if (kept !== undefined) keptScript(filename, kept, code);

            return { code, attributes: rest };
        }
    };
}

// `<svelte:options customElement="my-tag">` on a Python component, given the
// type of each prop its annotation names, so that an attribute arrives as the
// number or the list it declares: Svelte learns an element's props from the
// names the props destructure, and gives them no type. In the written-out
// object form, an entry the author wrote in `props` is theirs and is kept, and
// every other prop is added beside it, as Svelte adds the props of a
// destructured `$props()`. Only where the file declares the element: a
// component Svelte compiles as one by its compile options, which no
// preprocessor is handed, takes its props from the names alone, its attributes
// strings, as a Svelte component's are.
//
// The attribute as Svelte's own parser reads it, whatever its spelling: a tag
// quoted or not, `customElement=my-tag`, its character references decoded,
// `sol-&#97;` being `sol-a`; the written-out object, whose keys are its
// top-level properties, not a `props:` spelled inside a string or in the body of
// `extend`, and with no tag an element registered by hand from
// `Component.element`; but `{null}`, which declares nothing (`compileOptionsFor`),
// is left to Svelte. Matched by its spelling, an unquoted tag was given no
// props, and an attribute arrived as a string. The scripts and
// styles are blanked first, lines and offsets kept, since the Python one is not
// JavaScript and a style may not be CSS yet.
const ELEMENT_OPTION = /<svelte:options\b[^>]*?\bcustomElement\b/;

function elementAttribute(code) {
    return parse(blankBodies(code), { modern: true }).options?.attributes.find((one) => one.name === 'customElement');
}

// A custom element's props, each with the type its annotation names, read off
// the script with the names the `<script module>` gives it.
const elementPropsText = (python, jsNames) =>
    elementProps(python, jsNames)
        .map(({ name, type }) => `${name}: {${type ? ` type: ${JSON.stringify(type)} ` : ''}}`)
        .join(', ');

// vite-plugin-svelte's compile, its own (`api.compileSvelte`) made to place
// each warning Svelte makes on what was written (`placeWarning`) before the
// author's own filter reads it: set by its configuration, read by its compile
// once both are resolved, so held as it is set, whichever comes first. It
// decides nothing of the compile.
const HELD_COMPILES = new WeakSet();

function holdCompile(api) {
    if (HELD_COMPILES.has(api)) return;
    HELD_COMPILES.add(api);

    // The global filter and one `dynamicCompileOptions` answers, which
    // vite-plugin-svelte puts over it: answered there, it read the columns of
    // the code emitted. The answer wrapped as vite-plugin-svelte asks for it,
    // once and of the code it compiles.
    const placing = (file, filter) => (warning) => (placeWarning(warning, file), filter === undefined ? true : filter(warning));
    const placed = (file, dynamic) => async (...asked) => {
        const answer = await dynamic(...asked);

        return answer !== null && typeof answer === 'object' && Object.hasOwn(answer, 'warningFilter')
            ? { ...answer, warningFilter: placing(file, answer.warningFilter) }
            : answer;
    };
    // The map vite-plugin-svelte hands with the code is that of the
    // preprocessors, a preprocessor after Svelthon's among them: one that adds
    // lines moves the code Svelte warns of, read by the map back to where
    // Svelthon emitted it.
    const hold = (compile) =>
        typeof compile === 'function'
            ? (request, code, options, environment, sourcemap, ...rest) => {
                  const written = writtenAs(request.filename, code);
                  const file = written !== undefined && sourcemap?.mappings ? { ...written, trace: new TraceMap(sourcemap) } : written;

                  if (file === undefined) return compile(request, code, options, environment, sourcemap, ...rest);

                  const dynamic = options.dynamicCompileOptions === undefined ? {} : { dynamicCompileOptions: placed(file, options.dynamicCompileOptions) };
                  const compilerOptions = { ...options.compilerOptions, warningFilter: placing(file, options.compilerOptions?.warningFilter) };

                  return compile(request, code, { ...options, ...dynamic, compilerOptions }, environment, sourcemap, ...rest);
              }
            : compile;
    let held = hold(api.compileSvelte);

    Object.defineProperty(api, 'compileSvelte', {
        configurable: true,
        enumerable: true,
        get: () => held,
        set: (compile) => {
            held = hold(compile);
        }
    });
}

// The props are read off the script with the names the `<script module>` gives
// it (`jsNames`), as the compile reads them: `amount: int = inspect(1)`, its
// `inspect` the module's, is a prop, where taken for the marker it was left out
// of the list and its attribute read as a string.
function elementOptions(code, python, jsNames = []) {
    const key = (one) => (one.type === 'Property' ? (one.key.name ?? one.key.value) : undefined);
    const entry = ({ name, type }) => `${name}: {${type ? ` type: ${JSON.stringify(type)} ` : ''}}`;
    // Read only for a component that is an element: every Python component
    // comes through here.
    const props = () => elementPropsText(python, jsNames);

    if (!ELEMENT_OPTION.test(markupOnly(code))) return code;

    const attribute = elementAttribute(code);
    const value = attribute?.value;

    if (isNull(value)) return code;

    // A tag: the whole attribute written out with the props.
    if (Array.isArray(value)) {
        const tag = JSON.stringify(value.map((one) => one.data ?? '').join(''));

        return `${code.slice(0, attribute.start)}customElement={{ tag: ${tag}, props: { ${props()} } }}${code.slice(attribute.end)}`;
    }

    const object = value?.expression;

    if (object?.type === 'ObjectExpression') {
        const named = object.properties.find((one) => key(one) === 'props');

        if (named === undefined) {
            const at = object.start + 1;
            return `${code.slice(0, at)} props: { ${props()} },${code.slice(at)}`;
        }

        // Anything but a literal is not ours to read, and Svelte refuses it.
        if (named.value.type !== 'ObjectExpression') return code;

        // The missing props go after the author's last entry, in the order they
        // are declared, which is the order Svelte lists them in for the same
        // element written with `$props()`. The author's text stays where it is,
        // line for line.
        //
        // And an entry the author wrote keeps every field it writes, and is
        // given the type its annotation names when it writes none, as Svelte
        // infers one for a prop of `$props()` whose entry configures something
        // else: `{ reflect: true }` on a `bool` lost the type, and an attribute
        // present but empty arrived as the empty string, which Python reads
        // false.
        const written = named.value.properties;
        const names = new Set(written.map(key));
        const declared = elementProps(python, jsNames);
        const types = new Map(declared.map(({ name, type }) => [name, type]));
        const missing = declared.filter(({ name }) => !names.has(name)).map(entry);
        const edits = written.flatMap((one) => {
            const type = types.get(key(one));
            const value = one.value;

            return type && value?.type === 'ObjectExpression' && !value.properties.some((part) => key(part) === 'type')
                ? [{ at: value.start + 1, text: ` type: ${JSON.stringify(type)},` }]
                : [];
        });

        if (missing.length > 0) {
            edits.push(
                written.length === 0
                    ? { at: named.value.start + 1, text: ` ${missing.join(', ')} ` }
                    : { at: written.at(-1).end, text: `, ${missing.join(', ')}` }
            );
        }

        return edits
            .sort((one, other) => other.at - one.at)
            .reduce((text, { at, text: added }) => `${text.slice(0, at)}${added}${text.slice(at)}`, code);
    }

    return code;
}

// The generated script on as many lines as the Python it replaces. Svelte
// compiles the preprocessed text and places its warnings on it, and neither
// vite-plugin-svelte nor svelte-check maps them back: a longer script moved every
// warning about the markup below it, `<img>` on line 12 reported on line 78.
// The generated code has no comment and no multiline literal, and every line
// ends a statement or opens one, so its tail can share a line.
function sameLines(code, content) {
    const lines = code.split('\n');
    const count = content.split('\n').length;

    if (lines.length <= count) return code + '\n'.repeat(count - lines.length);

    return [...lines.slice(0, count - 1), lines.slice(count - 1).join(' ')].join('\n');
}

// And the columns, which the lines kept cannot keep: `{word}` emitted as a call
// is longer, and a warning about the `<img>` after it on its line was placed
// where the call pushed it. What each component was written as and emitted as,
// by its file (`WRITTEN_AS`), on the global the plugin shares with the
// preprocessor, and each warning Svelte makes placed back on what was written
// (`placeWarning`), which the plugin asks of it (`holdCompile`).
const WRITTEN_AS = (globalThis[Symbol.for('svelthon.writtenAs')] ??= new Map());

// Found again by its script as the script pass compiled it, and not by the file
// alone: two variants of one file (`?variant=…`) are preprocessed under its
// name, and the second took the text of the first. The script names its
// module by the whole file it was handed (`bodyId`), and no other preprocessor
// rewrites it: by the markup, a class another added made both variants the
// file's last. And nothing else is taken for it: the file's last, taken where
// none was found, gave a variant the text of another and a file rewritten in
// JavaScript that of the Python it was.
//
// Kept until its compile reads it, then until another of the file is read: a
// count of eight lost the ninth variant prepared at once, and forgetting the
// file once it was JavaScript lost a Python variant of it still compiling.
const KEPT_FOR = new WeakMap();

// What the markup pass kept, by what it hands the script pass (`calls`).
function keepWritten(filename, about, kept) {
    KEPT_FOR.set(about, kept);
    WRITTEN_AS.set(filename, [...(WRITTEN_AS.get(filename) ?? []), kept]);
}

// And the script the script pass compiled, the same preprocessing kept before
// forgotten: its compile reads this one.
function keptScript(filename, kept, script) {
    kept.script = script;
    WRITTEN_AS.set(filename, (WRITTEN_AS.get(filename) ?? []).filter((one) => one === kept || one.script !== script));
}

function writtenAs(filename, code) {
    const all = WRITTEN_AS.get(filename) ?? [];
    const found = all.findLast((kept) => kept.script !== undefined && code.includes(kept.script));

    if (found !== undefined) {
        found.read = true;
        WRITTEN_AS.set(filename, all.filter((kept) => kept === found || !kept.read));
    }

    return found;
}

// The column of the line `written` that `column` of the line `emitted` stands
// for, the two aligned on what they share. Asked of what the steps after the
// markup pass made of its text, which put a statement or an attribute into a
// script or an option, and rename a rune there: they rewrite nothing the author
// wrote, so what the two lines share is what stayed. A column inside what was
// put in is that of what follows it. A line too long to align keeps its column.
//
// Aligned word by word, not letter by letter: the declarations written after
// the markup, on its last line where the file ends without a newline, held
// every letter of the rest of the line in order.
const TOKEN = /[\p{L}\p{N}_$]+|\s+|[^]/gu;

function writtenColumn(emitted, written, column) {
    const tokens = (line) => Array.from(line.matchAll(TOKEN), (found) => [found[0], found.index]);
    const [from, to] = [tokens(emitted), tokens(written)];
    const [n, m] = [from.length, to.length];

    if (n * m > 4_000_000) return Math.min(column, written.length);

    const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));

    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            table[i][j] = from[i][0] === to[j][0] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
        }
    }

    let [i, j] = [0, 0];

    while (i < n && j < m) {
        const [text, at] = from[i];
        const within = column < at + text.length;

        if (text === to[j][0] && table[i][j] === table[i + 1][j + 1] + 1) {
            if (within) return to[j][1] + Math.max(0, column - at);
            i += 1;
            j += 1;
        } else if (table[i + 1][j] >= table[i][j + 1]) {
            if (within) break;
            i += 1;
        } else {
            j += 1;
        }
    }

    return j < m ? to[j][1] : written.length;
}

// The offset of what was written that `offset` of the markup pass's text stands
// for, read off the stretch it falls in (`marks`): the same in a stretch copied,
// and in one the pass rewrote, `{picture}` made a call, the same at its start
// and its end as far as they read as written, and the start of what it rewrote
// in between.
function writtenOffset({ marks, code, written }, offset) {
    let [low, high] = [0, marks.length / 2 - 1];

    while (low < high) {
        const middle = (low + high + 1) >> 1;

        if (marks[2 * middle + 1] <= offset) low = middle;
        else high = middle - 1;
    }

    const [fromIn, fromOut, toIn, toOut] = marks.slice(2 * low, 2 * low + 4);

    if (toOut === undefined) return Math.min(fromIn + offset - fromOut, written.length);

    const [made, was] = [code.slice(fromOut, toOut), written.slice(fromIn, toIn)];
    let same = 0;
    let end = 0;

    while (same < made.length && same < was.length && made[same] === was[same]) same += 1;
    while (end < made.length - same && end < was.length - same && made.at(-1 - end) === was.at(-1 - end)) end += 1;

    if (offset - fromOut <= same) return fromIn + offset - fromOut;

    return offset >= toOut - end ? toIn - (toOut - offset) : fromIn + same;
}

// The line an offset is on, by where each line starts.
function lineAt(starts, offset) {
    let [low, high] = [0, starts.length - 1];

    while (low < high) {
        const middle = (low + high + 1) >> 1;

        if (starts[middle] <= offset) low = middle;
        else high = middle - 1;
    }

    return low;
}

// Svelte's own frame (`get_code_frame`), drawn on the lines written.
function writtenFrame(lines, line, column) {
    const spaced = (text) => text.replace(/^\t+/, (tabs) => tabs.split('\t').join('  '));
    const [start, end] = [Math.max(0, line - 2), Math.min(line + 3, lines.length)];
    const digits = String(end + 1).length;

    return lines
        .slice(start, end)
        .map((text, at) => {
            const number = String(at + start + 1).padStart(digits, ' ');

            return start + at === line ? `${number}: ${spaced(text)}\n${' '.repeat(digits + 2 + spaced(text.slice(0, column)).length)}^` : `${number}: ${spaced(text)}`;
        })
        .join('\n');
}

// Placed by the compile that made it, and not by the file it names: Svelte
// names it relative to its `rootDir`, the working directory by default, where
// the preprocessor was handed the whole path.
function placeWarning(warning, file) {
    if (!warning?.start || !warning.end) return warning;

    const written = file.written.split('\n');
    const emitted = file.emitted.split('\n');
    const code = file.code.split('\n');
    const startsOf = (lines) => lines.reduce((starts, line) => (starts.push(starts.at(-1) + line.length + 1), starts), [0]);
    const [starts, codeStarts] = [startsOf(written), startsOf(code)];

    // Read by the map into the stretch it starts: the end of an `<img>` that
    // ends its line falls past the last stretch the map starts, and was taken
    // for the start of that one, the `>`.
    const placed = (compiled) => {
        const segment = file.trace === undefined ? null : traceSegment(file.trace, compiled.line - 1, compiled.column);
        const at = segment === null || segment.length < 4 ? compiled : { line: segment[2] + 1, column: segment[3] + compiled.column - segment[0] };
        const line = at.line - 1;

        if (written[line] === undefined || emitted[line] === undefined || code[line] === undefined) return compiled;
        if (written[line] === emitted[line]) return { line: at.line, column: at.column, character: starts[line] + at.column };

        const column = code[line] === emitted[line] ? at.column : writtenColumn(emitted[line], code[line], at.column);
        const character = writtenOffset(file, codeStarts[line] + column);
        const placedLine = lineAt(starts, character);

        return { line: placedLine + 1, column: character - starts[placedLine], character };
    };

    warning.start = placed(warning.start);
    warning.end = placed(warning.end);
    if (warning.position) warning.position = [warning.start.character, warning.end.character];
    if (warning.frame !== undefined) warning.frame = writtenFrame(written, warning.start.line - 1, warning.end.column);

    return warning;
}

// A store is served on every request in dev, and compiling Python is the
// expensive half. Keyed on what the file holds, read at each ask, which costs
// nothing beside a compile: keyed on its date, a file a copy or a tool wrote
// again under the date it had served the code it held before, to a second
// build in the same process as to a save Vite reports.
const compiledStores = new Map();

// A shared store is a plain .py file. It compiles to module-scope signals,
// created once for the whole application rather than per component instance,
// and is served under a `.svelte.js` identity, which is what makes
// vite-plugin-svelte compile the runes inside it.
//
// The compile checks every import against the files it finds, so the files its
// imports resolve to are part of the key: a module deleted or renamed beside it
// compiles, and checks, this one again.
//
// So is the path the file is reached by, from the root of the project asking,
// which its module name and the import of that module are made of: one file
// shared by two projects is `../shared/x.py` from one and `../../shared/x.py`
// from the other, and each project imports the module of its own path.
//
// And the modules its star imports read, by their text: what one publishes is
// what the other exports to the framework (`starNames`).
function compilePython(file, path, root) {
    const source = readFileSync(file, 'utf8');
    const shown = relative(root, file);
    const cached = compiledStores.get(file);
    if (
        cached &&
        cached.source === source &&
        cached.shown === shown &&
        cached.found === foundAs(cached.result.imports, dirname(file), path) &&
        cached.stars.every(([one, text]) => readOr(one) === text)
    ) {
        REFUSED_IMPORTS.delete(file);
        return cached.result;
    }

    const mode = isReactive(file)
        ? { store: true }
        : { plain: true, eager: isRemote(file), read: routeNames(file), serverRoute: /[/\\]\+(?:page|layout)\.server\.py$/.test(file) };
    const stars = [];
    const missing = [];
    const result = refusedFor(file, missing, () =>
        compile(source, nameFor(file, root), shown, {
            ...mode,
            sourceContent: source,
            resolves: (mod) => kindNoted(moduleKind(mod, dirname(file), path), mod, missing),
            starNames: (mod, level) => publishedBy(starredFile(mod, level, dirname(file), path), path, stars)
        })
    );

    compiledStores.set(file, { source, shown, result, found: foundAs(result.imports, dirname(file), path), stars });
    return result;
}

// The generated module, behind the imports it needs evaluated first.
//
// Exported, and it is the one export in this file that exists for its test: the
// rest is reachable through a hook, and this is not. What it holds is
// arithmetic, **one `;` per prelude line and not one `;` in total**, and a count
// reproduced through the door would take one fixture per count, which tests the
// fixture.
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
//
// The module as Python reaches it, `PYTHON_QUERY`: evaluated in front of the
// importer, so its code is at hand, and its body left to the import
// statement, which runs it when, and if, it is reached.
function pythonImports(names, fromDirectory, path) {
    return names
        .flatMap((mod) => moduleFile(mod, fromDirectory, path) || [])
        .map((path) => `import ${JSON.stringify(path + PYTHON_QUERY)};`)
        .join('\n');
}

// A `.py` is served twice. Under the query, the module itself, whose body waits
// for an import (`moduleLoad` in Brycomp). Under its own path, what
// JavaScript and SvelteKit import: the same module, its body run as this one is
// evaluated, as importing a JavaScript module runs it. One module behind both,
// so a name Python changes is the name JavaScript reads.
//
// A `.remote.py` is served once, under its own path, whatever asks for it.
const PYTHON_QUERY = '?python';

// An author's own query or fragment, `./counter.py?v=2` or `#v2`, is the same
// file under another id, as Vite and Svelte's plugin take a `.ts` or a `.svelte`
// with one, and Vite's own queries, its text, its URL or a worker of it
// (`SPECIAL_QUERY_RE`), are answered by Vite. A `#` is a fragment after the
// last `/` only: cut at the first one, as Vite cuts an id, a project in a
// `has#hash/` folder lost its path and handed Rolldown its Python.
const VITE_QUERY = /[?&](?:worker|sharedworker|raw|url)\b/;

// SvelteKit's `transport` for Python's values (`transport.js`), installed with
// no file of the author's at the two places SvelteKit starts it: its own
// `#app/internal/transport`, whose `init_transport` the server calls with the
// application's hooks, wrapped to add ours before them; and the client's
// generated manifest, whose `hooks.transport` the browser decodes by.
const KIT_TRANSPORT = '#app/internal/transport';
const TRANSPORT_WRAPPER = '\0svelthon-transport?';
const TRANSPORT_SERVER_WRAPPER = '\0svelthon-transport-server?';
const transportFile = (name = 'transport.js') => fileURLToPath(new URL(`./${name}`, import.meta.url));

// The key the server signs what it encodes while it builds by, the data a
// remote function prerenders, which it reads back from the site's address
// (`transport-server.js`): one per build, written into the server's code alone.
let transportKey;

const transportWrapper = (real, server) =>
    [
        `export * from ${JSON.stringify(real)};`,
        `import { init_transport as __brycomp_kit } from ${JSON.stringify(real)};`,
        `import { transport as __brycomp_svelthon, applicationTransport as __brycomp_application } from ${JSON.stringify(transportFile())};`,
        ...(server
            ? [
                  `import { signed as __brycomp_signed } from ${JSON.stringify(transportFile('transport-server.js'))};`,
                  `import { building as __brycomp_building } from '$app/environment';`,
                  `import { getRequestEvent as __brycomp_event } from '$app/server';`,
                  `const __brycomp_readingBack = () => { try { return __brycomp_event().isRemoteRequest === false; } catch { return false; } };`,
                  `const __brycomp_python = __brycomp_signed(__brycomp_svelthon, ${JSON.stringify((transportKey ??= randomBytes(32).toString('hex')))}, () => __brycomp_building, __brycomp_readingBack);`,
                  `export function init_transport(transport) { __brycomp_application(transport); __brycomp_kit({ ...__brycomp_python, ...transport }); }`
              ]
            : [`export function init_transport(transport) { __brycomp_kit({ ...__brycomp_svelthon, ...transport }); }`])
    ].join('\n');

// What a `.remote.py` imports of `$app/server` on the server: SvelteKit's own,
// its four remote functions taking the Python function they declare through
// the bridge's relay (`remoteHelper`), which hands SvelteKit what the browser
// reads of each answer where a page of the server reads it, outside a remote
// request.
const KIT_SERVER = '$app/server';
const REMOTE_SERVER = '\0svelthon-remote-server?';

const remoteServer = (real) =>
    [
        `export * from ${JSON.stringify(real)};`,
        `import { query as __brycomp_query, command as __brycomp_command, form as __brycomp_form, prerender as __brycomp_prerender, getRequestEvent as __brycomp_event } from ${JSON.stringify(real)};`,
        `import { remoteHelper as __brycomp_remote } from 'svelthon/bridge';`,
        `const __brycomp_inRemote = () => { try { return __brycomp_event().isRemoteRequest === true; } catch { return false; } };`,
        `export const query = __brycomp_remote(__brycomp_query, __brycomp_inRemote);`,
        `export const command = __brycomp_remote(__brycomp_command, __brycomp_inRemote);`,
        `export const form = __brycomp_remote(__brycomp_form, __brycomp_inRemote);`,
        `export const prerender = __brycomp_remote(__brycomp_prerender, __brycomp_inRemote);`
    ].join('\n');

// A JavaScript server module's `load`, `+page.server.js` or `.ts`, wrapped by
// the transport's relay (`serverLoad`): its page reads on the server what the
// browser reads of the Python values it returns. The binding the module exports
// as `load` is exported no more, its wrapper is in its place: a declaration
// binding `load`, a list naming one, re-exported from another module or not,
// or a module it re-exports all of. Read by Svelte's own parser, TypeScript
// included, so that a `load` in a comment or a string is none. The wrapper
// reads the binding at each call (`liveLoad`), as SvelteKit reads the export at
// each request: a module that binds `load` again is served the new one.
const SERVER_ROUTE = /[/\\]\+(?:page|layout)\.server\.[cm]?[jt]s$/;
const SCRIPT_OPEN = '<script lang="ts">';

// The names a declaration binds: a plain name, or each one a pattern holds.
const boundNames = (pattern) => {
    switch (pattern?.type) {
        case 'Identifier':
            return [pattern.name];
        case 'ObjectPattern':
            return pattern.properties.flatMap((one) => boundNames(one.type === 'RestElement' ? one.argument : one.value));
        case 'ArrayPattern':
            return pattern.elements.flatMap(boundNames);
        case 'AssignmentPattern':
            return boundNames(pattern.left);
        case 'RestElement':
            return boundNames(pattern.argument);
    }
    return [];
};

const specifierName = (name) => (name.type === 'Identifier' ? name.name : name.value);

// The re-exports of a module that re-exports all of others, by its file.
const STARS = '?svelthon-stars';
const STARRED = new Map();

const starredModule = (id) => (STARRED.get(id.slice(0, -STARS.length)) ?? []).map((from) => `export * from ${from};`).join('\n');

function withServerLoad(code, id) {
    if (id.endsWith(STARS) || !SERVER_ROUTE.test(splitQuery(id)[0]) || !/load|export\s*\*/.test(code)) return undefined;

    let body;

    try {
        body = parse(`${SCRIPT_OPEN}${code.replaceAll('</script', '</scrip_')}</script>`, { modern: true }).instance?.content.body;
    } catch {
        return undefined;
    }

    const at = (node) => node.start - SCRIPT_OPEN.length;
    const end = (node) => node.end - SCRIPT_OPEN.length;
    const edits = [];
    const appended = [];
    const stars = [];
    let local;

    for (const node of body ?? []) {
        if (node.exportKind === 'type' || local !== undefined) continue;
        if (node.type === 'ExportAllDeclaration') {
            if (node.exported === null) stars.push(code.slice(at(node.source), end(node.source)));
            continue;
        }
        if (node.type !== 'ExportNamedDeclaration') continue;

        const { declaration, specifiers, source } = node;

        if (declaration) {
            const names =
                declaration.type === 'FunctionDeclaration'
                    ? [declaration.id?.name]
                    : declaration.type === 'VariableDeclaration'
                      ? declaration.declarations.flatMap((one) => boundNames(one.id))
                      : [];

            if (!names.includes('load')) continue;

            const others = names.filter((name) => name !== 'load');

            local = 'load';
            edits.push([at(node), at(declaration), '']);
            if (others.length > 0) appended.push(`export { ${others.join(', ')} };`);
            continue;
        }

        // A type re-exported under the name, `export { type Payload as load }`,
        // is no load: taken for one, its value was imported, which the module
        // has not, and the build stopped.
        const one = specifiers.find((spec) => specifierName(spec.exported) === 'load' && spec.exportKind !== 'type');

        if (one === undefined) continue;

        const from = source ? ` from ${code.slice(at(source), end(source))}` : '';
        const rest = specifiers.filter((spec) => spec !== one).map((spec) => code.slice(at(spec), end(spec)));
        const kept = rest.length > 0 ? `export { ${rest.join(', ')} }${from};` : '';

        if (source === null) {
            local = specifierName(one.local);
            edits.push([at(node), end(node), kept]);
        } else {
            local = '__brycomp_svelthon_route_load';
            edits.push([at(node), end(node), `import { ${code.slice(at(one.local), end(one.local))} as ${local} }${from}; ${kept}`]);
        }
    }

    // Exported by a module it re-exports all of: read off a module that does
    // nothing but re-export them (`STARS`), which the module system resolves
    // as it resolves this one, a `load` two of them export differently left out.
    // None exported is none (`exported`): a relay would have SvelteKit ask the
    // server for data at each navigation, a module of shared options among them.
    let exported;

    if (local === undefined && stars.length > 0) {
        STARRED.set(splitQuery(id)[0], stars);
        appended.push(`import * as __brycomp_svelthon_stars from ${JSON.stringify(splitQuery(id)[0] + STARS)};`);
        local = '__brycomp_svelthon_stars.load';
        exported = `'load' in __brycomp_svelthon_stars`;
    }

    if (local === undefined) return undefined;

    let out = code;

    for (const [start, stop, text] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + text + out.slice(stop);

    const relayed = `__brycomp_svelthon_liveLoad(() => ${local})`;

    return [
        out,
        ...appended,
        `import { liveLoad as __brycomp_svelthon_liveLoad } from ${JSON.stringify(transportFile())};`,
        `const __brycomp_svelthon_load = ${exported === undefined ? relayed : `${exported} ? ${relayed} : undefined`};`,
        `export { __brycomp_svelthon_load as load };`
    ].join('\n');
}

const KIT_MANIFEST = /[/\\]\.svelte-kit[/\\]generated[/\\]/;
const MANIFEST_TRANSPORT = /transport: ([^\n]*?)\{\}\n/;

const withPythonTransport = (code, id) => {
    if (!KIT_MANIFEST.test(id) || !code.includes('export const decoders')) return undefined;
    if (!MANIFEST_TRANSPORT.test(code)) {
        throw new Error(
            `svelthon — SvelteKit's client manifest (${id}) no longer writes its hooks' \`transport\` as ` +
                `Svelthon reads it, so the browser could not read what Python hands it: a SvelteKit Svelthon was not made for`
        );
    }

    // The application's own, known from here: the data the page was rendered
    // with is decoded as the manifest loads, before SvelteKit starts it.
    return (
        `import { transport as __brycomp_svelthon_transport, applicationTransport as __brycomp_svelthon_application } from ${JSON.stringify(transportFile())};\n` +
        code.replace(MANIFEST_TRANSPORT, (_, before) => `transport: __brycomp_svelthon_application({ ...__brycomp_svelthon_transport, ...(${before}{}) })\n`)
    );
};

const splitQuery = (id) => {
    const at = id.search(/\?|#[^/]*$/);

    return at === -1 ? [id, ''] : [id.slice(0, at), id.slice(at)];
};

function eagerModule(file) {
    const body = JSON.stringify(file + PYTHON_QUERY);

    return [
        // The module's default export is the function that runs its body.
        `import load from ${body};`,
        `load();`,
        `export * from ${body};`,
        // A store is also its own default export.
        ...(isReactive(file) ? [`export { store as default } from ${body};`] : [])
    ].join('\n');
}

// Vite's dependency scanner reads each `<script>` of a `.svelte` file as
// JavaScript, the Python one too: every cold start said `Failed to run
// dependency scan`, a SvelteKit project once per page. The script reaches the
// scan as a module of its own, `<file>?id=<n>`, numbered as the scanner numbers
// them (Vite's `htmlTypeOnLoadCallback`), and a Python one is handed over as the
// modules it imports (`scannedScript`): from JavaScript, and the files of its
// Python imports, which the scan reads in turn, a `.py` being scannable
// (`optimizeDeps.extensions`, as vite-plugin-svelte makes a `.svelte`). A
// package only a `.py` brought was found at the first visit, optimized then,
// and the page reloaded when it shared code with one optimized already.
//
// Which scripts get a number is read with Vite's own patterns for `type` and
// `src`, or a number would name another script; whether that script is Python,
// with the reading of every other site (`declaresPython`): Vite's pattern took
// the `lang` of a `data-lang`, or a `lang='js'` inside another attribute's value.
//
// Vite 8 scans with Rolldown, under `virtual-module:`; Vite 7 with esbuild, in
// its `script` namespace, where a plugin of the config is asked before Vite's
// own loader and hands the script itself, read off the file.
const SCANNED_SCRIPT = /^(?:virtual-module:)?(.*\.svelte)\?id=(\d+)$/;
const SCRIPT_TAG = /(<script(?:\s+[a-z_:][-\w:]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^"'<>=\s]+))?)*\s*>)(.*?)<\/script>/gis;
const viteAttribute = (tag, name) => {
    const found = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s'">]+))`, 'i').exec(tag);

    return found && (found[1] || found[2] || found[3]);
};

// The Python script the scan is handed under `id`, or null for any other.
const scannedPython = (id) => {
    const found = SCANNED_SCRIPT.exec(id);
    let at = 0;

    if (found === null) return null;

    for (const [, open, content] of readFileSync(found[1], 'utf8').replace(/<!--.*?-->/gs, '<!---->').matchAll(SCRIPT_TAG)) {
        const type = viteAttribute(open, 'type');

        if (type && !(type.includes('javascript') || type.includes('ecmascript') || type === 'module')) continue;
        if (viteAttribute(open, 'src') || !content.trim()) continue;
        if (at++ === Number(found[2])) return declaresPython(open) ? content : null;
    }

    return null;
};

// A component's script is read with the names its `<script module>` binds, as
// the compile reads it (`moduleImports`).
const scannedComponent = (code, file, found) => scannedScript(code, found(file), true, moduleImports(readFileSync(file, 'utf8')));

// Vite hands its optimizer the scan's plugins too, where a `.py` is no module
// to read the imports of: the scan is told apart by its own plugin, as
// vite-plugin-svelte tells it.
const pythonScan = (found) => {
    let scanning = false;

    return {
        name: 'svelthon:dep-scan',
        options(options) {
            scanning = options.plugins.some((one) => one?.name === 'vite:dep-scan:resolve');
        },
        transform(code, id) {
            if (id.endsWith('.py')) return scanning ? { code: scannedScript(code, found(id), false), moduleType: 'js' } : null;

            return scannedPython(id) === null ? null : { code: scannedComponent(code, SCANNED_SCRIPT.exec(id)[1], found), moduleType: 'js' };
        }
    };
};

const pythonScanEsbuild = (found) => ({
    name: 'svelthon:dep-scan',
    setup(build) {
        build.onLoad({ filter: /\.svelte\?id=\d+$/, namespace: 'script' }, ({ path }) => {
            const python = scannedPython(path);

            return python === null ? undefined : { contents: scannedComponent(python, path.replace(/\?id=\d+$/, ''), found), loader: 'js', resolveDir: dirname(path) };
        });

        if (build.initialOptions?.plugins?.some((one) => one.name === 'vite:dep-scan')) {
            build.onLoad({ filter: /\.py$/ }, ({ path }) => ({
                contents: scannedScript(readFileSync(path, 'utf8'), found(path), false),
                loader: 'js',
                resolveDir: dirname(path)
            }));
        }
    }
});

// What SvelteKit reads by name off a module of its routes or of its hooks,
// exported whatever binds it there (`read`), a star import among them: one list
// per kind of module, SvelteKit's own (`valid_*_exports` for a route, which it
// refuses any other name of; `get_hooks` and the client's manifest for hooks).
// A hook bound by a call, `handle = sequence(first, second)`, was no export:
// the development server answered without it, in silence.
const LAYOUT_NAMES = ['load', 'prerender', 'csr', 'ssr', 'trailingSlash', 'config'];
const ROUTE_NAMES = [
    [/[/\\]\+layout(?:\.server)?\.py$/, LAYOUT_NAMES],
    [/[/\\]\+page\.py$/, [...LAYOUT_NAMES, 'entries']],
    [/[/\\]\+page\.server\.py$/, [...LAYOUT_NAMES, 'actions', 'entries']],
    [/[/\\]\+server\.py$/, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'fallback', 'prerender', 'trailingSlash', 'config', 'entries']],
    [/[/\\]hooks\.server\.py$/, ['handle', 'handleFetch', 'handleError', 'init']],
    [/[/\\]hooks\.client\.py$/, ['handleError', 'init']],
    [/[/\\]hooks\.py$/, ['reroute', 'transport']]
];

const routeNames = (file) => ROUTE_NAMES.find(([kind]) => kind.test(file))?.[1] ?? [];

// What `compile()` asks through `resolves`: `'file'` when the name stands for
// one, `'package'` when its first segment is a directory where a file would
// be looked for, which the refusal then names, and nothing otherwise.
function moduleKind(mod, fromDirectory, path) {
    if (moduleFile(mod, fromDirectory, path)) return 'file';

    const [first] = mod.split('.');
    const directory = searchedFrom(fromDirectory, path).some((one) =>
        statSync(resolve(one, first), { throwIfNoEntry: false })?.isDirectory()
    );

    return directory ? 'package' : undefined;
}

// A file's text, or null for one gone.
const readOr = (file) => {
    try {
        return readFileSync(file, 'utf8');
    } catch {
        return null;
    }
};

// What a starred file publishes, its own star imports read from its folder in
// turn, each file read kept for the cache (`stars`); nothing known of a file
// missing, or of one a cycle reads again.
function publishedBy(found, path, stars, seen = new Set()) {
    const text = found === undefined || seen.has(found) ? null : readOr(found);

    if (text === null) return null;

    stars.push([found, text]);

    return publishedNames(text, (mod, level) => publishedBy(starredFile(mod, level, dirname(found), path), path, stars, new Set([...seen, found])));
}

// The file a star import reads, `from handlers import *` as an absolute one is
// found, `from .handlers import *` beside the module, or nothing.
function starredFile(mod, level, fromDirectory, path) {
    if (level === 0) return moduleFile(mod, fromDirectory, path);

    const base = resolve(fromDirectory, ...Array(level - 1).fill('..'));
    const named = resolve(base, ...mod.split('.').filter(Boolean));

    return [`${named}.py`, resolve(named, '__init__.py')].find(isFile);
}

// A file, or a link to one: a directory named like a module is passed by, as
// CPython passes it by.
const isFile = (candidate) => statSync(candidate, { throwIfNoEntry: false })?.isFile() === true;

// The file a module name stands for, or nothing.
function moduleFile(mod, fromDirectory, path) {
    return searchedFrom(fromDirectory, path)
        .flatMap((directory) => [resolve(directory, `${mod}.svelte.py`), resolve(directory, `${mod}.py`)])
        .find(isFile);
}

// Where a module name is looked for: the importer's own directory, then the
// configured path.
//
// The path is given by the caller that knows which configuration it belongs
// to, and read off the shared value only by the one that cannot know.
// `python(options)` writes that global as it is constructed, so reading it
// unconditionally let a second preprocessor with a different path change what
// the first one resolved.
function searchedFrom(fromDirectory, path) {
    return [fromDirectory, ...(path || globalThis[Symbol.for('svelthon.path')] || [])];
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

// A module of SvelteKit's remote functions has one half, the module itself, its
// body run as it is evaluated and nothing exported by default, as a route
// module that SvelteKit loads when it decides. SvelteKit takes for one every id
// its pattern matches, `/[/.]remote\.[^/]+$/`, the query included: a second
// half, `peps.remote.py?python`, was a second remote module to it, refused for
// the default export that runs its body.
//
// Its rule, read on the file's name, with SvelteKit or without it: `remote.py`
// as well as `peps.remote.py`. Python can import the first, `import remote`,
// and its body then runs as it loads and not at the import statement, which
// is where this departs from CPython.
const isRemote = (file) => /[/.]remote\.py$/.test(file);

// Svelthon and the packages it brings, where they really are. Installed from
// checkouts beside the application, each is a link Vite follows out of the
// project, whose files it then refused to serve, every page at a 403, unless
// the application listed each of them; installed from the registry, they are
// inside the project already.
const served = () => {
    const own = fileURLToPath(new URL('../..', import.meta.url));

    return [
        realpathSync(own),
        ...Object.keys(JSON.parse(readFileSync(resolve(own, 'package.json'), 'utf8')).dependencies ?? {})
            .map((name) => resolve(own, 'node_modules', name))
            .filter((path) => existsSync(path))
            .map((path) => realpathSync(path))
    ];
};

// The Vite plugin that serves those modules.
export function svelthon(options = {}) {
    const isVirtual = (id) => id.startsWith(VIRTUAL_PREFIX);

    // The plugin compiles the `.py` files themselves and resolves their imports
    // the same way a component's are resolved. It is the half that cannot tell
    // configurations apart, so it takes the path when it is given one and falls
    // back to the value `python(options)` left on the global otherwise, which is
    // right for the ordinary case of one configuration per process.
    // The project this plugin serves, read as it is made, the way Vite reads its
    // configuration in the project's directory: what the process is in when it
    // later asks for a module may be another project. Its path is resolved
    // against it now, as the preprocessor resolves its own.
    const root = process.cwd();
    const searchPath = searchPathOf(options, root);
    const key = (id) => generatedKey(root, id);

    // Whether a module is Python's: a `.py` file, or the body of one, served
    // under an id of its own that names the file it was compiled from.
    const pythonImporter = (importer) =>
        splitQuery(importer)[0].endsWith('.py') || (importer.startsWith('\0') && generated.get(key(importer.slice(1)))?.file !== undefined);

    // Whether a change of a file leaves it as it was compiled from
    // (`compiledAsBefore`), asked once per change, its `timestamp`, which Vite
    // hands every environment alike (`hotUpdate`).
    const answered = new Map();
    const unchangedAt = (file, timestamp) => {
        if (timestamp === undefined) return compiledAsBefore(file);

        const known = answered.get(file);

        if (known?.timestamp === timestamp) return known.unchanged;

        const unchanged = compiledAsBefore(file);

        answered.set(file, { timestamp, unchanged });
        return unchanged;
    };

    // Where an id with no importer is rooted, SvelteKit's route entries among
    // them, `/src/routes/+page.server.py`: Vite's own root once Vite has
    // resolved its configuration, and until then the project this plugin was
    // made in. Never the directory the process happens to be in when it asks.
    let routes = root;

    // A file is the one its path leads to, as Vite resolves one unless told to
    // keep links (`resolve.preserveSymlinks`): a link and its target are one
    // module, which, taken by their two paths, were two files of one Python
    // name, and the second import was refused as a clash.
    //
    // When they share their name. A module is the one Python imports by the
    // name of the file it finds, the link's: `config.py` leading to
    // `settings_dev.py` is `config`, and a store `cart.svelte.py` leading to
    // `cart_impl.py` is a store. Taken for its target, the module was compiled
    // as `settings_dev`, and `import config` found no module of its name.
    let preserveSymlinks = false;

    // What a `.remote.py`'s `$app/server` reaches this plugin as: SvelteKit's
    // alias makes a path of `$app` before `resolveId` is asked
    // (`configResolved`).
    let kitServer = KIT_SERVER;

    const fileOf = (path) => {
        if (preserveSymlinks) return path;

        const real = realpathSync(path);

        return basename(real) === basename(path) ? real : path;
    };

    const pyFile = (id, importer) => {
        const direct = importer ? resolve(dirname(importer), id) : resolve(routes, id);
        if (existsSync(direct)) return fileOf(direct);

        // A leading slash means two different things. An alias has already
        // produced a real filesystem path; SvelteKit's own route entries are
        // relative to the **project root**, `/src/routes/+page.server.py`,
        // which no filesystem has. Note that `resolve(dir, '/x')` ignores `dir`
        // entirely, so having an importer does not help here: only trying the
        // file tells the two apart, and getting it wrong reads as
        // `ENOENT: stat '/src/routes/+page.server.py'`.
        if (id.startsWith('/')) {
            const fromRoot = resolve(routes, `.${id}`);
            if (existsSync(fromRoot)) return fileOf(fromRoot);
        }

        return direct;
    };

    // A `.py` compiled: its script, and its body filed under its name, with the
    // file, the text and the prelude it was compiled to. A `.py` may import
    // another one, a route module reaching for its data layer: same prelude a
    // component gets.
    const compileModule = (file) => {
        const content = readFileSync(file, 'utf8');
        const name = nameFor(file, root);
        const { script, module, map, imports } = compilePython(file, searchPath, root);
        const prelude = pythonImports(imports, dirname(file), searchPath);

        generated.set(key(virtualId(name)), { ...withPrelude(module, map, prelude), file, content, imports, prelude });

        return script;
    };

    // Whether a body is the file's as it is now: its text, and its imports
    // found where they were; a file gone keeps the body it had.
    const compiledFrom = (entry) => {
        try {
            return (
                readFileSync(entry.file, 'utf8') === entry.content &&
                pythonImports(entry.imports, dirname(entry.file), searchPath) === entry.prelude
            );
        } catch {
            return true;
        }
    };

    // The bodies generated from `file` that its change leaves stale in one
    // environment's graph, forgotten there; none when the file is not ours.
    const forgotten = (file, graph, timestamp) => {
        const stale = [];

        const forget = (id) => {
            const mod = graph.getModuleById(id);
            if (mod) {
                graph.invalidateModule(mod);
                stale.push(mod);
            }
        };

        // `mangle` and not `nameFor`: this sees every changed file in the
        // project and is only asking whether one of them is ours.
        const name = mangle(file, root);
        const own = key(virtualId(name));
        const bodies = [...generated.keys()].filter((one) => one === own || one.startsWith(`${own}?`));

        if (bodies.length === 0) return;

        // A component asked again as it was compiled, its source, each
        // child's language and its modules as they were: its generated code
        // is as it was, and what changed is another input of its compile, a
        // stylesheet its `<style lang="scss">` imports, which Svelte's
        // plugin updates as it updates any component, its style alone. Its
        // bodies forgotten, it was mounted anew, its state lost; and with
        // nothing handed on, it kept the old style.
        //
        // Asked once per change, of the first environment Vite hands it
        // to, the client's, before anything compiles it again: the
        // client's hook of vite-plugin-svelte transforms the component,
        // and an edit then looked compiled as before to the server's, whose
        // page kept rendering the previous body. The others take that
        // answer, under the change's one `timestamp`.
        if (unchangedAt(file, timestamp)) return;

        for (const one of bodies) forget('\0' + one.slice(key('').length));
        slots.delete(own);

        // A store's .py is watched, not imported, so its own module has to
        // be invalidated too, otherwise its load() never reruns and
        // `generated` keeps the previous body, exactly the staleness this
        // exists to prevent.
        if (file.endsWith('.py')) {
            forget(file);
            forget(file + PYTHON_QUERY);
        }

        return stale;
    };

    return {
        name: 'svelthon:modules',
        // A module that appears or leaves may change where an import of its
        // name is found: moved from the path to beside its importer, or back.
        // The importer's prelude names the file it was compiled against, and
        // nothing else asks it again, so each one whose imports are found
        // elsewhere now is changed, as an edit of its own would be: a
        // component (`compiledAsBefore`), and a module of Python, `relay.py`
        // importing `helper` for the component that imports `relay`
        // (`foundAs`). Left alone, the page asked for the file no longer
        // there until the importer itself was edited. An importer refused for
        // a module missing is changed too when that module appears
        // (`REFUSED_IMPORTS`).
        //
        // And a child that changes language changes each parent compiled for
        // the other one, which the props it hands that child were converted
        // for; a child edited in its own language changes none. The children
        // are no dependencies of their parent then (`WATCHED_CHILDREN`): each
        // edit of one asked its parents again, and a parent that had nothing
        // to update was mounted anew, its state lost, unless it was taken for
        // compiled as before, which also swallowed the change of a stylesheet
        // the parent's own style imports.
        configureServer(server) {
            WATCHED_CHILDREN.add(server.watcher);

            const moved = (file) => {
                const name = /^(.+?)(?:\.svelte)?\.py$/.exec(basename(file))?.[1];

                if (name === undefined) return;

                for (const [source, before] of COMPILED_FROM) {
                    if (before.imports?.names.includes(name) && existsSync(source) && !compiledAsBefore(source)) {
                        server.watcher.emit('change', source);
                    }
                }

                for (const [module, compiled] of compiledStores) {
                    const { imports } = compiled.result;

                    if (imports.includes(name) && existsSync(module) && compiled.found !== foundAs(imports, dirname(module), searchPath)) {
                        server.watcher.emit('change', module);
                    }
                }

                for (const [importer, missing] of REFUSED_IMPORTS) {
                    if (missing.includes(name) && existsSync(importer)) server.watcher.emit('change', importer);
                }
            };

            // The watcher hands what this emits back to it at once: a component
            // importing itself, or two importing each other, would be changed
            // without end. One whose change is being handed reaches its
            // listeners already.
            const relanguaging = new Set();

            const relanguaged = (file) => {
                if (!file.endsWith('.svelte')) return;

                let python;

                try {
                    python = pythonFile(file);
                } catch {
                    return;
                }

                relanguaging.add(file);
                try {
                    for (const [source, before] of COMPILED_FROM) {
                        if (!relanguaging.has(source) && existsSync(source) && before.children.some(([path, was]) => path === file && was !== python)) {
                            server.watcher.emit('change', source);
                        }
                    }
                } finally {
                    relanguaging.delete(file);
                }
            };

            // And a module whose star imports read the one changed, which
            // publishes what that one exports to the framework (`starNames`):
            // the route served the new body of `GET`, and answered 405 to the
            // `POST` its starred module's `__all__` had just gained, until the
            // route itself was edited.
            const restarred = (file) => {
                for (const [module, compiled] of compiledStores) {
                    if (module !== file && existsSync(module) && compiled.stars.some(([one, text]) => one === file && readOr(one) !== text)) {
                        server.watcher.emit('change', module);
                    }
                }
            };

            server.watcher.on('add', moved);
            server.watcher.on('unlink', moved);
            server.watcher.on('change', (file) => {
                relanguaged(file);
                restarred(file);
            });

            // Without HMR, vitest's server among them, Vite asks no
            // `hotUpdate`, and a `.py` kept the body it was first compiled to,
            // which nothing ties to its file: a test rerun after an edit ran
            // the old Python. Each change forgets it as that hook does.
            if (server.config?.server?.hmr === false) {
                const changed = (file) => {
                    for (const environment of Object.values(server.environments)) forgotten(file, environment.moduleGraph);
                };

                for (const event of ['add', 'change', 'unlink']) server.watcher.on(event, changed);
            }
        },
        // 'pre', or Vite's own resolver claims `./store.py` as a plain file and
        // hands its Python straight to the JS parser.
        enforce: 'pre',
        // Svelthon transformed for the server, as vite-plugin-svelte declares
        // Svelte and `esm-env`: the bridge tells a server from a browser by the
        // conditions it is resolved under (`__brycomp_pybridge.browser`), and a package
        // left to Node is resolved under none, where `esm-env` reads a
        // `window`. Installed from npm, a server with a DOM on its global was a
        // browser again; a linked checkout, which Vite transforms, was not.
        //
        // And the dependency scanner handed what a Python script imports from
        // JavaScript rather than its Python (`pythonScan`), by Rolldown's
        // option or by esbuild's, whichever scans: Vite 8 warns of the second.
        config() {
            // Beside the importer: a path that resolves to itself, an absolute
            // one, is external to Vite's scan (`shouldExternalizeDep`).
            const found = (from) => (mod) => {
                const file = moduleFile(mod, dirname(from), searchPath);

                return file === undefined ? [] : [`./${relative(dirname(from), file).replaceAll('\\', '/')}`];
            };
            const scan = this?.meta?.rolldownVersion
                ? { rolldownOptions: { plugins: [pythonScan(found)] } }
                : { esbuildOptions: { plugins: [pythonScanEsbuild(found)] } };

            return { ssr: { noExternal: ['svelthon'] }, optimizeDeps: { ...scan, extensions: ['.py'] } };
        },
        // SvelteKit refuses to build code that runs in the browser and imports a
        // module of a `server/` directory, a `*.server.*` file or `$app/server`.
        // Its guard sees what reaches its own resolution and load first: listed
        // after this plugin, which resolves and loads what Python imports, it
        // saw none of it, and a secret of `src/lib/server/` was built into the
        // client's bundle without a word.
        configResolved(config) {
            routes = config.root;
            preserveSymlinks = config.resolve?.preserveSymlinks === true;

            // Svelthon and the packages it brings served (`served`), added to
            // what Vite serves for the root it settled on, the application's
            // list or its workspace: given in `config()`, the list held the root
            // known then, and a plugin choosing the root later had the
            // application's own files refused.
            config.server?.fs?.allow?.push(...served());

            const app = [config.resolve?.alias ?? []].flat().find((one) => one.find === '$app')?.replacement;

            if (typeof app === 'string') kitServer = `${app}/server`;

            // SvelteKit hands Vite's scan its route modules by a pattern of its
            // own, `+*.{svelte,js,ts}`, whatever `moduleExtensions` names: what a
            // `+page.py` brought was found at its first visit. Its pattern, for
            // Python's, its exclusion of the server's standing.
            const entries = config.optimizeDeps?.entries;

            if (Array.isArray(entries)) {
                for (const one of entries.filter((entry) => entry.endsWith('/**/+*.{svelte,js,ts}'))) entries.push(one.replace(/\{svelte,js,ts\}$/, 'py'));
            }

            const names = config.plugins.map((one) => one.name);

            if (names.indexOf('vite-plugin-sveltekit-guard') > names.indexOf('svelthon:modules')) {
                throw new Error(
                    'svelthon — list `sveltekit()` before `svelthon()` in `plugins`: SvelteKit\'s guard ' +
                        'against a server module in the browser sees only what reaches it first, so ' +
                        'after Svelthon it misses every module Python imports, a `src/lib/server/` one ' +
                        'built into the client among them'
                );
            }

            // vite-plugin-svelte's own, whose compile places each warning
            // Svelte makes on what was written (`holdCompile`).
            const svelte = config.plugins.find((one) => one.name === 'vite-plugin-svelte:config')?.api;

            if (svelte) holdCompile(svelte);
        },
        resolveId(specifier, importer) {
            if (specifier === KIT_TRANSPORT) {
                const wrapper = this.environment === undefined || this.environment.name === 'client' ? TRANSPORT_WRAPPER : TRANSPORT_SERVER_WRAPPER;

                return this.resolve(specifier, importer, { skipSelf: true }).then((real) => (real ? wrapper + real.id : real));
            }

            // A Python module's `$app/server`, by its name or by the path
            // SvelteKit's alias makes of it before this hook is asked
            // (`kitServer`): asked by the name alone, the remote functions
            // stayed SvelteKit's own, and a page the server rendered read the
            // raw answer where the browser read it rebuilt. Told by its text,
            // and not by resolving `$app/server` here, which the alias handed
            // back to this hook without end. Any Python module's, a
            // `.remote.py`'s or the body of one a remote module imports: a
            // factory there made the remote functions SvelteKit's own.
            if ((specifier === KIT_SERVER || specifier === kitServer) && importer !== undefined && pythonImporter(importer)) {
                return this.resolve(specifier, importer, { skipSelf: true }).then((real) => (real ? REMOTE_SERVER + real.id : real));
            }

            // A component's import of itself is the module that imports it, as
            // it was asked for (`announced`).
            if (specifier === SELF && importer !== undefined) return importer;
            if (isVirtual(specifier)) return '\0' + specifier;

            // The module as Python reaches it, or as an author asks for it with
            // a query, is resolved as its file is and keeps its query, but for
            // a `.remote.py`, which has one half.
            const [id, query] = splitQuery(specifier);
            if (!id.endsWith('.py') || VITE_QUERY.test(query)) return;

            // Without an importer either: SvelteKit hands its route modules to
            // Vite as already-resolved entries, with nobody to resolve against.
            // Only a path we can resolve ourselves. A bare or aliased specifier
            // such as `#lib/peps.py` belongs to whoever defined the alias, and
            // reaches load() as an absolute path once they have.
            if (id.startsWith('.') || id.startsWith('/')) return pyFile(id, importer) + (isRemote(id) ? '' : query);
        },
        load(id) {
            if (id.startsWith(REMOTE_SERVER)) return remoteServer(id.slice(REMOTE_SERVER.length));
            if (id.endsWith(STARS)) return starredModule(id);
            if (id.startsWith(TRANSPORT_SERVER_WRAPPER)) return transportWrapper(id.slice(TRANSPORT_SERVER_WRAPPER.length), true);
            if (id.startsWith(TRANSPORT_WRAPPER)) return transportWrapper(id.slice(TRANSPORT_WRAPPER.length), false);

            if (id.startsWith('\0')) {
                let entry = generated.get(key(id.slice(1)));

                // A `.py`'s body is the file as it is now, whichever is asked
                // first: a page whose update was under way when a second save
                // came asked for the body before the file, and was served the
                // body of the save before, which stayed its body for every
                // later save, until the server restarted.
                if (entry?.file !== undefined && !compiledFrom(entry)) {
                    compileModule(entry.file);
                    entry = generated.get(key(id.slice(1)));
                }

                // A component's body asked under a number a change of its file
                // took back, by such a page: the body of the component
                // compiled before, the one that page runs, served and not kept,
                // or the component compiled next, which asks the same number,
                // was served it too, until the next save.
                if (entry?.numbering !== undefined && slots.get(entry.own) !== entry.numbering) {
                    const graph = this.environment?.moduleGraph;
                    const mod = graph?.getModuleById(id);

                    if (mod) graph.invalidateModule(mod);
                }

                return entry && (entry.map ? { code: entry.code, map: entry.map } : entry.code);
            }

            const [file, query] = splitQuery(id);
            if (!file.endsWith('.py') || VITE_QUERY.test(query)) return;

            // Compiled under either id, so a refusal is reported against the
            // file JavaScript imported, the first one asked.
            const deferred = query === PYTHON_QUERY;
            const script = compileModule(file);

            this.addWatchFile(file);

            // JavaScript's import of the file, which runs the module's body, or
            // the module itself when it runs its body on its own.
            return deferred || isRemote(file) ? script : eagerModule(file);
        },

        // The client's manifest SvelteKit generates, its hooks' `transport`
        // given Python's first (`withPythonTransport`); and a JavaScript server
        // module's `load` (`withServerLoad`).
        transform(code, id) {
            return withPythonTransport(code, id) ?? withServerLoad(code, id);
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
        //
        // A component's bodies are told apart by a number per content
        // (`bodyId`): the file's are forgotten here, in each environment's
        // graph, and the numbers handed out again, so a save keeps its ids and
        // `generated` one body per variant in use. A `.py` keeps its one body
        // under its name.
        //
        // A child a Python parent holds rather than imports, `<Child …/>` of a
        // prop, is told Python's or JavaScript's as the page runs, by the
        // component it is (`__brycomp_pybridge.child`), and Svelte's HMR keeps that
        // component across an edit while running what the file now is. So a
        // file that changes language reloads the page where such a parent is
        // compiled, as one imported recompiles its parents (`relanguaged`): a
        // JavaScript child edited into Python was handed JavaScript's numbers.
        //
        // An importer refused before Vite ever analysed it, on the first visit,
        // accepts no update, and Vite stops the update there: marked as Vite
        // marks an importer whose import it could not resolve, the update goes
        // on to the page.
        hotUpdate({ file, modules, timestamp }) {
            if (REFUSED_IMPORTS.has(file)) for (const mod of modules) mod.isSelfAccepting ??= false;

            const stale = forgotten(file, this.environment.moduleGraph, timestamp);

            if (this.environment.name === 'client' && relanguages(file) && [...COMPILED_FROM].some(([source, one]) => one.holding && existsSync(source))) {
                this.environment.hot.send({ type: 'full-reload' });
                return [];
            }

            return stale && [...modules, ...stale];
        }
    };
}
