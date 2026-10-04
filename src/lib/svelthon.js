import { createRequire } from 'node:module';
import { relative, resolve, dirname } from 'node:path';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';

import {
    overMarkup,
    pythonScript,
    pythonExpressions,
    collector,
    moduleScript,
    withoutComments,
    markupOnly
} from './markup.js';
import { parse } from 'svelte/compiler';

const require = createRequire(import.meta.url);
const { compile, VIRTUAL_PREFIX, virtualId, pythonModuleName, elementProps, PY_NAME } = require('./compile.cjs');

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
// The key holds the project as well as the id: the directory the process is in,
// which every name is relative to. Two projects built in one process, each with
// a `src/Card.svelte`, give the same id, and one map under the id alone handed
// the first project's plugin the second project's Python.
const generated = (globalThis[Symbol.for('svelthon.generated')] ??= new Map());
const generatedKey = (root, id) => `${root}\n${id}`;

// Which file claimed each generated name, on the same global registry and for
// the same reason: the preprocessor and the plugin are not always the same
// module instance.
const claimed = (globalThis[Symbol.for('svelthon.claimed')] ??= new Map());

// The name alone, for a caller that is only asking a question. `hotUpdate` runs
// for every file the dev server sees change, component or not, and all it wants
// to know is whether a module of that name exists. Asking must not claim.
const mangle = (filename) =>
    relative(process.cwd(), filename || 'Component').replace(/\W/g, '_');

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
// not a collision, it is a rename.** The refusal keeps the case it is for, two
// files that both exist.
export const nameFor = (filename) => {
    const path = relative(process.cwd(), filename || 'Component');
    const name = mangle(filename);
    const first = claimed.get(name);

    if (first !== undefined && first !== path && existsSync(first)) {
        throw new SyntaxError(
            `svelthon — \`${path}\` and \`${first}\` both compile to the module name ` +
                `\`${name}\`, so one would silently run the other's Python. Rename ` +
                `one of them: the name is the path with every character that cannot ` +
                `appear in a JavaScript identifier replaced by \`_\`.`
        );
    }

    claimed.set(name, path);
    if (path.endsWith('.py')) claimPython(path);

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

function claimPython(path) {
    const name = pythonModuleName(path);
    if (!IMPORTABLE.test(name)) return;

    const first = pythonClaimed.get(name);

    if (first !== undefined && first !== path && existsSync(first)) {
        throw new SyntaxError(
            `svelthon — \`${path}\` and \`${first}\` are both imported as \`${name}\`, ` +
                `so one would silently replace the other. Rename one of them: a module's ` +
                `Python name is its file name, and \`import ${name}\` cannot say which ` +
                `directory it means.`
        );
    }

    pythonClaimed.set(name, path);
}

// The tag that decides a file is Python is read by `pythonScript`, in markup.js,
// off the real script blocks and their real attributes — the same grammar that
// pass uses to know what *not* to rewrite. One reading, because the `script`
// hook below has a reading of its own that it cannot be talked out of
// (`attributes.lang`), and every file the two disagreed about was broken.

// HTML allows whitespace before the `>` of a closing tag, and Svelte's parser
// reads it — its own fixture is named `whitespace-after-style-tag`. Svelte's
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
function refuseSpacedClose(closing, filename) {
    if (closing === '</script>') return;

    throw new SyntaxError(
        `svelthon — the Python \`<script>\` is closed with \`${closing}\`, and Svelte's ` +
            `preprocessor only recognises \`</script>\`: the block never reaches it, so the ` +
            `Python is handed to the compiler as JavaScript and every name it declares is ` +
            `missing at run time. Close it with \`</script>\` ` +
            `(${relative(process.cwd(), filename || 'Component')})`
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

// The names a statement at the top of the module binds there, at run time. A
// TypeScript `import type`, `export type` or `declare` names a type or an
// ambient value, which no code at run time holds, so it binds nothing.
const declares = (node) => {
    if (node.declare || node.importKind === 'type' || node.exportKind === 'type') return [];

    switch (node.type) {
        case 'ImportDeclaration':
            return node.specifiers.filter((one) => one.importKind !== 'type').map((one) => one.local.name);
        case 'VariableDeclaration':
            return node.declarations.flatMap((one) => declaredBy(one.id));
        case 'FunctionDeclaration':
        case 'ClassDeclaration':
            return declaredBy(node.id);
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
// in a block, belong to the block; a function's body is a scope of its own.
const SCOPES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'ClassDeclaration',
    'ClassExpression'
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

export function moduleImports(content) {
    const block = moduleScript(content);

    if (block === null) return [];

    let module;

    try {
        // The element as written, so `lang="ts"` parses its annotations.
        module = parse(block, { modern: true }).module;
    } catch {
        // A block that does not parse is one Svelte is about to refuse itself,
        // naming the line. Publishing nothing leaves that message as the only
        // one the author sees, rather than ours in front of it.
        return [];
    }

    const body = module?.content?.body ?? [];

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
export const compileOptionsFor = (code) =>
    /<svelte:options[^>]*\bcustomElement\b/.test(markupOnly(code)) ? { customElement: true } : undefined;

// What the `markup` hook works out about a file and the `script` hook then needs:
//
// - `lineOffset`: Python line numbers count from the start of the <script> body
//   and the file counts from its first line. The gap is the number of lines
//   before the opening tag.
// - `defs`: the hidden functions the markup needs, appended to its Python.
// - `jsNames`: what the file imports from JavaScript.
// - `element`: whether the file declares itself a custom element.
//
// One entry per call of Svelte's `preprocess()`, not per file. Two calls on two
// versions of one file can run at once, both `markup` hooks before either
// `script` hook, and an entry under the filename gave the first version the
// second one's expressions. The `markup` hook writes the entry's key on the
// Python `<script>` tag as the attribute below, which Svelte hands to the
// `script` hook with the others, and the `script` hook takes the attribute off.
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
    const at = pythonScript(withoutComments(code)).index + '<script'.length;

    return `${code.slice(0, at)} ${CALL}="${key}"${code.slice(at)}`;
}

// The Svelte preprocessor: runs before Svelte parses the component, so the
// compiler only ever sees ordinary JavaScript with runes.
// `path` mirrors PYTHONPATH: the directories searched for the `.py` a component
// imports, after its own. Without it, `import counter_store` only ever resolves
// to a sibling file, and a component that reached the module some other way
// would appear to work purely by load order.
export function python(options = {}) {
    const searchPath = options.path || [];
    const calls = perCall();

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
            const declaring = pythonScript(withoutComments(content));

            if (declaring === null) return;

            refuseSpacedClose(declaring.closing, filename);

            const file = {
                jsNames: moduleImports(content),
                element: compileOptionsFor(content) !== undefined,
                lineOffset: content.slice(0, declaring.index).split('\n').length - 1,
                defs: [],
                defLines: [],
                defColumns: []
            };

            // The collector itself is in markup.js, which the browser can load.
            const collect = collector(file.defs, file.defLines, file.defColumns);

            const code = overMarkup(content, (markup, offset) =>
                // The chunk, and where it starts, so a refusal can name a
                // line and a column in the file the author is looking at.
                pythonExpressions(markup, collect, undefined, { filename, content, offset })
            );

            const open = content.indexOf('>', declaring.index) + 1;
            const python = content.slice(open, content.indexOf('</script', open));

            return { code: tagged(elementOptions(code, python), calls.open(file)) };
        },
        script({ content, attributes, filename }) {
            if (attributes.lang !== 'python') return;

            const { lang, [CALL]: call, ...rest } = attributes;
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
            if (attributes.module || attributes.context === 'module') {
                throw new SyntaxError(
                    `svelthon — a <script module> cannot hold Python; state shared ` +
                        `by every instance belongs in a .svelte.py module, which a ` +
                        `component imports like any other ` +
                        `(${relative(process.cwd(), filename || 'Component')})`
                );
            }

            const name = nameFor(filename);
            const { script, module, map, imports } = compile(
                content,
                name,
                relative(process.cwd(), filename || 'Component'),
                {
                    ...about,
                    // The whole file, so a debugger opens the .svelte itself.
                    sourceContent: filename ? readFileSync(filename, 'utf8') : content,
                    resolves: (mod) => moduleKind(mod, dirname(filename || '.'), searchPath)
                }
            );

            // `import counter_store` in a component resolves to a .py file, its
            // own directory first, then `path`. The module has to be evaluated
            // before init() runs, so its namespace is registered by the time
            // Brython looks it up.
            const prelude = pythonImports(imports, dirname(filename || '.'), searchPath);

            generated.set(generatedKey(process.cwd(), virtualId(name)), withPrelude(module, map, prelude));

            // The content is JavaScript now, so the tag must stop claiming
            // otherwise. Leaving `lang="python"` in place is invisible to the
            // Svelte compiler, which parses the content as JavaScript either
            // way, but every tool downstream reads the attribute and refuses:
            // `svelte-check`, installed by 93% of SvelteKit projects, would
            // report dozens of parse errors per component.
            return { code: sameLines(script, content), attributes: rest };
        }
    };
}

// `<svelte:options customElement="my-tag">` on a Python component, given its
// props. Svelte learns a custom element's props from a destructured `$props()`,
// which the generated script does not write, so without this list the element
// observed no attribute and exposed no property: it read its attributes once,
// at connection. Each prop carries the type its annotation names, so an
// attribute arrives as the number or the list it declares. In the written-out
// object form, an entry the author wrote in `props` is theirs and is kept, and
// every other prop is added beside it, as Svelte adds the props of a
// destructured `$props()`: configuring one prop stopped the element observing
// all the others.
const ELEMENT_OPTION = /<svelte:options\b[^>]*?\bcustomElement\s*=\s*(["'])([^"']*)\1/;

// The written-out form, `customElement={{ tag: "x", shadow: "none" }}`, which is
// the only way to set `shadow`: the props go into it when it names none. Any
// expression is a candidate, however it is laid out; Svelte's parser says
// whether it is an object.
const ELEMENT_OBJECT = /<svelte:options\b[^>]*?\bcustomElement\s*=\s*\{/;

// The written-out object itself, as Svelte's own parser reads it: its keys are
// its top-level properties, not a `props:` spelled inside a string or in the
// body of `extend`. The scripts and styles are blanked first, lines and
// offsets kept, since the Python one is not JavaScript and a style may not be
// CSS yet.
const BLOCK = /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/g;

function elementObject(code) {
    const blanked = code.replace(BLOCK, (_, open, name, body, close) => open + body.replace(/[^\n]/g, ' ') + close);
    const expression = parse(blanked, { modern: true })
        .options?.attributes.find((one) => one.name === 'customElement')?.value?.expression;

    return expression?.type === 'ObjectExpression' ? expression : null;
}

function elementOptions(code, python) {
    const key = (one) => (one.type === 'Property' ? (one.key.name ?? one.key.value) : undefined);
    const entry = ({ name, type }) => `${name}: {${type ? ` type: ${JSON.stringify(type)} ` : ''}}`;
    // Read only for a component that is an element: every Python component
    // comes through here.
    const props = () => elementProps(python).map(entry).join(', ');

    const text = markupOnly(code);

    if (ELEMENT_OBJECT.test(text)) {
        const object = elementObject(code);
        if (object === null) return code;

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
        const written = named.value.properties;
        const names = new Set(written.map(key));
        const missing = elementProps(python).filter(({ name }) => !names.has(name)).map(entry);

        if (missing.length === 0) return code;

        if (written.length === 0) {
            const at = named.value.start + 1;
            return `${code.slice(0, at)} ${missing.join(', ')} ${code.slice(at)}`;
        }

        const at = written.at(-1).end;
        return `${code.slice(0, at)}, ${missing.join(', ')}${code.slice(at)}`;
    }

    const found = ELEMENT_OPTION.exec(text);
    if (found === null) return code;
    const attribute = found[0].slice(found[0].search(/\bcustomElement\s*=/));
    const at = found.index + found[0].length - attribute.length;

    return (
        code.slice(0, at) +
        `customElement={{ tag: ${JSON.stringify(found[2])}, props: { ${props()} } }}` +
        code.slice(at + attribute.length)
    );
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
//
// The compile checks every import against the files it finds, so the files its
// imports resolve to are part of the key: a module deleted or renamed beside it
// compiles, and checks, this one again.
//
// So is the path the file is reached by, from the directory the process is in,
// which its module name and the import of that module are made of: one file
// shared by two projects is `../shared/x.py` from one and `../../shared/x.py`
// from the other, and the second was handed a script importing the first one's
// module.
function compilePython(file, path) {
    const stamp = statSync(file).mtimeMs;
    const shown = relative(process.cwd(), file);
    const cached = compiledStores.get(file);
    const found = (imports) => imports.map((mod) => moduleFile(mod, dirname(file), path) ?? '').join('\n');
    if (
        cached &&
        cached.stamp === stamp &&
        cached.shown === shown &&
        cached.found === found(cached.result.imports)
    ) {
        return cached.result;
    }

    const source = readFileSync(file, 'utf8');
    const mode = isReactive(file) ? { store: true } : { plain: true };
    const result = compile(source, nameFor(file), shown, {
        ...mode,
        sourceContent: source,
        resolves: (mod) => moduleKind(mod, dirname(file), path)
    });

    compiledStores.set(file, { stamp, shown, result, found: found(result.imports) });
    return result;
}

// Zero where there is nothing to count, which is every project but this one.
// `readdirSync('tests')` resolves against `process.cwd()`, so without this the
// demo's stats module took the dev server down with `ENOENT` in any tree with no
// `tests/`, or whenever the process was started from another directory. The
// demo reads the number and shows it; showing none is what zero is for.
const countTests = () =>
    (existsSync('tests') ? readdirSync('tests') : [])
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
function pythonImports(names, fromDirectory, path) {
    return names
        .flatMap((mod) => moduleFile(mod, fromDirectory, path) || [])
        .map((path) => `import ${JSON.stringify(path)};`)
        .join('\n');
}

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

// The file a module name stands for, or nothing.
function moduleFile(mod, fromDirectory, path) {
    return searchedFrom(fromDirectory, path)
        .flatMap((directory) => [resolve(directory, `${mod}.svelte.py`), resolve(directory, `${mod}.py`)])
        .find((candidate) => existsSync(candidate));
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

// The Vite plugin that serves those modules.
export function svelthon(options = {}) {
    const isVirtual = (id) => id.startsWith(VIRTUAL_PREFIX);

    // The plugin compiles the `.py` files themselves and resolves their imports
    // the same way a component's are resolved. It is the half that cannot tell
    // configurations apart, so it takes the path when it is given one and falls
    // back to the value `python(options)` left on the global otherwise, which is
    // right for the ordinary case of one configuration per process.
    const searchPath = options.path;

    // The project this plugin serves, read as it is made, the way Vite reads its
    // configuration in the project's directory: what the process is in when it
    // later asks for a module may be another project.
    const root = process.cwd();
    const key = (id) => generatedKey(root, id);

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
                const entry = generated.get(key(id.slice(1)));
                return entry && (entry.map ? { code: entry.code, map: entry.map } : entry.code);
            }
            if (!id.endsWith('.py')) return;

            const file = id;
            const name = nameFor(file);
            const { script, module, map, imports } = compilePython(file, searchPath);

            // A `.py` may import another one, a route module reaching for its
            // data layer. Same prelude a component gets.
            const prelude = pythonImports(imports, dirname(file), searchPath);

            generated.set(key(virtualId(name)), withPrelude(module, map, prelude));

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

            // A Python file Vite reports changed is compiled again, whatever its
            // date says: a copy or a tool that keeps `mtimeMs` left the cache
            // serving the code it had before.
            compiledStores.delete(file);

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

            // `mangle` and not `nameFor`: this hook sees every changed file in
            // the project and is only asking whether one of them is ours.
            const name = mangle(file);
            if (!generated.has(key(virtualId(name)))) return;

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
