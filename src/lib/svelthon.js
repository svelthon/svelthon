import { createRequire } from 'node:module';
import { relative, resolve, dirname } from 'node:path';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';

import {
    overMarkup,
    pythonScript,
    pythonExpressions,
    collector,
    moduleScript,
    directiveModules,
    withoutComments
} from './markup.js';
import { parse } from 'svelte/compiler';

const require = createRequire(import.meta.url);
const { compile, VIRTUAL_PREFIX, virtualId, pythonModuleName, elementProps } = require('./compile.cjs');

// Generated modules, keyed by component name. Filled by the preprocessor when
// Svelte transforms a component, read back when Vite resolves the import that
// the preprocessor just wrote into that component's script.
//
// Held on a global registry rather than in this module, because the two halves
// do not always land in the same module instance: SvelteKit loads
// `svelte.config.js` (where the preprocessor is declared) through its own
// loader, while Vite bundles `vite.config.js`, where the plugin is. This file
// is then evaluated twice, and a module-level Map would leave the plugin
// looking in an empty one.
const generated = (globalThis[Symbol.for('svelthon.generated')] ??= new Map());

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
const IMPORTABLE = /^[\p{L}_][\p{L}\p{M}\p{N}_]*$/u;

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

// What the `markup` hook works out about a file and the `script` hook then needs,
// one entry per file:
//
// - `lineOffset`: Python line numbers count from the start of the <script> body
//   and the file counts from its first line. The gap is the number of lines
//   before the opening tag.
// - `defs`: the hidden functions the markup needs, appended to its Python.
// - `jsNames`: what the file imports from JavaScript.
// - `pyDirectives`: the Python modules it names in a directive, which is the one
//   place a module needs a JavaScript binding of its own.
//
// Held inside `python()` and not at module scope, which is where they were. Both
// hooks live on the object it returns, so they have no reason to be shared by
// every preprocessor a process constructs: two of them, a playground beside a
// SvelteKit app, wrote into the same four maps keyed by filename and would have
// overwritten each other the day two filenames matched.
//
// `generated` and `claimed` above are the opposite case and stay global: the
// preprocessor and the plugin are not always the same module instance.
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
// **Read from Svelte's parse, not from the text.** This was a pair of regular
// expressions over the raw block, and a grammar reconstituted that way fails in
// both directions at once: it invented a binding for `// import Missing from
// './none.js'` — a commented-out import, or one quoted in a string — so the
// component died at mount with `Missing is not defined`, about a name present
// in no running code; and it read one name per declaration, so `const first =
// 1, second = 2` published `first` alone and Python raised `NameError` on the
// other, which a line break would have fixed. Destructuring published nothing
// at all.
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

const declares = (node) => {
    switch (node.type) {
        case 'ImportDeclaration':
            return node.specifiers.map((one) => one.local.name);
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

export function moduleImports(content) {
    const block = moduleScript(content);

    if (block === null) return [];

    let module;

    try {
        module = parse(`<script module>${block}</script>`, { modern: true }).module;
    } catch {
        // A block that does not parse is one Svelte is about to refuse itself,
        // naming the line. Publishing nothing leaves that message as the only
        // one the author sees, rather than ours in front of it.
        return [];
    }

    return [...new Set((module?.content?.body ?? []).flatMap(declares))];
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
// Read with the comments taken out, like every other reading of the markup: a
// declaration quoted in `<!-- -->` is documentation.
export const compileOptionsFor = (code) =>
    /<svelte:options[^>]*\bcustomElement\b/.test(withoutComments(code)) ? { customElement: true } : undefined;

const perFile = () => {
    const files = new Map();

    return (filename) => {
        let one = files.get(filename);

        if (one === undefined) {
            one = { lineOffset: 0, defs: [], jsNames: [], pyDirectives: [] };
            files.set(filename, one);
        }

        return one;
    };
};

// The Svelte preprocessor: runs before Svelte parses the component, so the
// compiler only ever sees ordinary JavaScript with runes.
// `path` mirrors PYTHONPATH: the directories searched for the `.py` a component
// imports, after its own. Without it, `import counter_store` only ever resolves
// to a sibling file, and a component that reached the module some other way
// would appear to work purely by load order.
export function python(options = {}) {
    const searchPath = options.path || [];
    const about = perFile();

    // Shared with the plugin, which compiles the `.py` files themselves and has
    // to resolve their imports the same way. The two halves may not be the same
    // module instance, so a value on the global is the only channel between
    // them. See the registry above.
    //
    // This preprocessor no longer reads it: it passes `searchPath` to the
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

            const file = about(filename);

            file.jsNames = moduleImports(content);
            file.pyDirectives = directiveModules(content);
            file.lineOffset = content.slice(0, declaring.index).split('\n').length - 1;
            file.defs = [];
            file.defLines = [];
            file.defColumns = [];

            // The collector itself is in markup.js, which the browser can load.
            const collect = collector(file.defs, file.defLines, file.defColumns);

            const code = overMarkup(content, (markup, offset) =>
                // The chunk, and where it starts, so a refusal can name a
                // line and a column in the file the author is looking at.
                pythonExpressions(markup, collect, undefined, { filename, content, offset })
            );

            const open = content.indexOf('>', declaring.index) + 1;
            const python = content.slice(open, content.indexOf('</script', open));

            return { code: elementOptions(code, python) };
        },
        script({ content, attributes, filename }) {
            if (attributes.lang !== 'python') return;

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
                    ...about(filename),
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

            generated.set(virtualId(name), withPrelude(module, map, prelude));

            // The content is JavaScript now, so the tag must stop claiming
            // otherwise. Leaving `lang="python"` in place is invisible to the
            // Svelte compiler, which parses the content as JavaScript either
            // way, but every tool downstream reads the attribute and refuses:
            // `svelte-check`, installed by 93% of SvelteKit projects, reported
            // dozens of parse errors per component until this line existed.
            const { lang, ...rest } = attributes;

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
// object form, a `props` the author wrote is theirs, and left as it is.
const ELEMENT_OPTION = /<svelte:options\b[^>]*?\bcustomElement\s*=\s*(["'])([^"']*)\1/;

// The written-out form, `customElement={{ tag: "x", shadow: "none" }}`, which is
// the only way to set `shadow`: the props go into it when it names none.
const ELEMENT_OBJECT = /<svelte:options\b[^>]*?\bcustomElement\s*=\s*\{\{/;

function elementOptions(code, python) {
    const props = () =>
        elementProps(python)
            .map(({ name, type }) => `${name}: {${type ? ` type: ${JSON.stringify(type)} ` : ''}}`)
            .join(', ');

    const text = withoutComments(code);
    const object = ELEMENT_OBJECT.exec(text);

    if (object !== null) {
        const at = object.index + object[0].length;
        const close = text.indexOf('}}', at);
        if (close === -1 || /\bprops\s*:/.test(text.slice(at, close))) return code;

        return `${code.slice(0, at)} props: { ${props()} },${code.slice(at)}`;
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
function compilePython(file, path) {
    const stamp = statSync(file).mtimeMs;
    const cached = compiledStores.get(file);
    const found = (imports) => imports.map((mod) => moduleFile(mod, dirname(file), path) ?? '').join('\n');
    if (cached && cached.stamp === stamp && cached.found === found(cached.result.imports)) return cached.result;

    const source = readFileSync(file, 'utf8');
    const mode = isReactive(file) ? { store: true } : { plain: true };
    const result = compile(source, nameFor(file), relative(process.cwd(), file), {
        ...mode,
        sourceContent: source,
        resolves: (mod) => moduleKind(mod, dirname(file), path)
    });

    compiledStores.set(file, { stamp, result, found: found(result.imports) });
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
// Exported, and it is the one export in this file that exists for its test.
// `pyCall`, `mangle` and the rest were privatised because their behaviour is
// reachable through a hook; this one is not. The defect it guards is arithmetic,
// **one `;` per prelude line and not one `;` in total**, which put every mapping
// one line too high the day a component imported two modules. Reproducing a
// count through the door would take one fixture per count, and a fixture that
// exists to make a number bigger tests the fixture.
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
                const entry = generated.get(id.slice(1));
                return entry && (entry.map ? { code: entry.code, map: entry.map } : entry.code);
            }
            if (!id.endsWith('.py')) return;

            const file = id;
            const name = nameFor(file);
            const { script, module, map, imports } = compilePython(file, searchPath);

            // A `.py` may import another one, a route module reaching for its
            // data layer. Same prelude a component gets.
            const prelude = pythonImports(imports, dirname(file), searchPath);

            generated.set(virtualId(name), withPrelude(module, map, prelude));

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
            if (!generated.has(virtualId(name))) return;

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
