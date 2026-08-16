'use strict';

// Build-time half of SVELTHON: run Brython's compiler under Node and split the
// result in two — a plain ES module holding the generated code, and a Svelte
// component script that wires it to runes.
//
// CommonJS because brython.js is a classic script that has to execute *after*
// the globals below are in place, which ES imports cannot order (they hoist).

globalThis.self ??= globalThis;           // touched by the bootstrap
globalThis.addEventListener ??= () => {}; // idem
globalThis.__BRYTHON__ ??= {};
globalThis.$B ??= globalThis.__BRYTHON__; // the codegen's eval() resolves $B globally

require('../../vendor/brython.js');

const $B = globalThis.__BRYTHON__;
$B.brython({ ipy_id: [] });

// The full stdlib, loaded at build time only — it is the *source* we take
// modules from, never something the browser downloads. Entries are
// [ext, source, deps, is_package], so the dependency graph is already computed.
require('../../vendor/brython_stdlib.js');

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

// Python identifiers that JavaScript will not accept as bindings. They stay
// perfectly usable inside the component's Python; they simply are not published
// to the template.
const JS_RESERVED = new Set(`break case catch class const continue debugger default delete do else
enum export extends false function if implements in instanceof interface let new null package
private protected public return static super switch this throw true typeof var void while with
yield arguments eval
py`.split(/\s+/));

// Module-level names, read off the AST rather than the generated JS — the
// codegen mangles function names (`increment941818`) but the AST has the truth.
function surface(body) {
    const props = [];
    const state = [];
    const funcs = [];
    const seen = new Set();

    const take = (name) => {
        if (seen.has(name) || JS_RESERVED.has(name)) return false;
        seen.add(name);
        return true;
    };

    for (const node of body) {
        if (node instanceof $B.ast.Assign) {
            for (const target of node.targets) {
                if (target instanceof $B.ast.Name && take(target.id)) state.push(target.id);
            }
        } else if (node instanceof $B.ast.AnnAssign) {
            // An annotation is a declaration of interface, like a dataclass
            // field: `name: str` is a prop, `count: int = 0` a prop with a
            // default. A bare assignment stays internal state.
            if (node.target instanceof $B.ast.Name && take(node.target.id)) props.push(node.target.id);
        } else if (node instanceof $B.ast.FunctionDef) {
            if (take(node.name)) {
                funcs.push({ name: node.name, arity: (node.args && node.args.args || []).length });
            }
        }
    }

    return { props, state, funcs };
}

// Transitive closure of a component's imports over the build-time stdlib.
// Anything already living in the runtime (sys's `_sys`, `browser`, builtins)
// is absent from the VFS and simply drops out.
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

function compile(src, name = 'Component', source = name, { store = false } = {}) {
    // The namespace identifier is derived from `filename` alone — `module` and
    // `locals_id` are ignored by js_from_root. Brython maps '.' to '_' but
    // leaves '/' alone, so a real path would emit `locals_src/Counter_svelte`,
    // which is not valid JavaScript. Pass an identifier-safe name instead; the
    // cost is that Python's __file__ says "Counter" rather than the full path.
    let root = $B.py2js({ src, filename: name }, name, [name]);
    let { props, state, funcs } = surface(root._ast.body);

    // A store has no parent, so an annotation there declares plain state — and
    // $props() would be meaningless at module scope anyway.
    if (store) {
        state = [...props, ...state];
        props = [];
    }

    // NOTE — traversing a DOM node from Python (`event.target.value`) resolves
    // the node's class through `$B.imported['browser.html']`, which only a real
    // import registers; it cannot be done at boot either, since $B.$import reads
    // $B.frame_obj, null until a module body runs. Injecting the import for any
    // component with a parameterised handler was considered and dropped: the
    // module builds a class per HTML tag, which is a real cost for the many
    // handlers that never touch a node. Components that need it write
    // `from browser import html`, verified by scripts/browser-check.sh.
    const js = root.to_js();

    if (!js.includes(namespaceCall(name))) {
        throw new Error(
            `svelthon: the code generated for ${name} never calls ${namespaceCall(name)} — ` +
                `Brython's codegen no longer exposes the module namespace where SVELTHON hooks it`
        );
    }

    // Svelte reserves the '$' prefix for *every* scope inside a component, and
    // Brython's codegen opens with `var $B = __BRYTHON__`. So the generated
    // code lives in its own module, which Svelte never parses.
    const vfs = stdlibClosure(Object.keys(root.imports));
    const needsStdlib = Object.keys(vfs).length > 0;

    const module = [
        `import { withNamespace, pyError } from 'svelthon/runtime';`,
        ...(needsStdlib ? [`import ${JSON.stringify(vfsId(name))};`] : []),
        ``,
        `export function init(${NS}) {`,
        `  try {`,
        `    return withNamespace('${name}', ${NS}, () => {`,
        js,
        `    });`,
        `  } catch (err) { throw pyError(err, ${JSON.stringify(source)}); }`,
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
    const fn = (name) => `__fn_${name}`;
    const local = (name) => `__local_${name}`;

    // Lifecycle by convention, mapped onto a single $effect: its body runs once
    // after the DOM exists, its teardown when the component goes away. Both
    // names stay ordinary functions — nothing stops Python calling them too.
    const lifecycle = (hook) => !store && funcs.some((f) => f.name === hook);

    // A component free to define its own `publish` keeps it.
    const hasPublish = [...props, ...state, ...funcs.map((f) => f.name)].includes('publish');

    const script = [
        `import { init } from ${JSON.stringify(virtualId(name))};`,
        // `py` backs the rewritten conditions, and is available to the template
        // for explicit conversions: {py.str(items)} renders ['a', 'b'].
        `import { bind, py, republish, pyError, NONE } from 'svelthon/runtime';`,
        ...(lifecycle('on_mount') || lifecycle('on_destroy')
            ? [`import { untrack } from 'svelte';`]
            : []),
        ``,
        ...(props.length ? [`const __props = $props();`, ``] : []),
        // A prop's value comes from the parent when it was passed, and from the
        // annotation's default otherwise — the default being whatever the Python
        // body assigned during init(). Reading __props keeps it reactive, so a
        // parent update flows into Python's namespace on the next read.
        ...props.flatMap((n) => [
            `let ${local(n)} = $state.raw(undefined);`,
            `const ${n} = $derived(('${n}' in __props ? __props.${n} : ${local(n)}) ?? NONE);`
        ]),
        ...state.map((n) => `let ${n} = $state.raw(undefined);`),
        ...funcs.map((f) => `let ${fn(f.name)} = $state.raw(undefined);`),
        ``,
        `const __proto = {};`,
        // Python may write to a prop; the write lands in the local fallback and
        // is shadowed for as long as the parent supplies a value, which is
        // Svelte's own rule for non-bindable props.
        //
        // The accessors read the raw cell, never the tracked binding: Python must
        // not subscribe to Svelte's graph, only feed it.
        ...props.map(
            (n) =>
                `bind(__proto, '${n}', () => ('${n}' in __props ? __props.${n} : ${local(n)}) ?? NONE, (v) => { ${local(n)} = v; });`
        ),
        ...state.map((n) => `bind(__proto, '${n}', () => ${n}, (v) => { ${n} = v; });`),
        ...funcs.map((f) => `bind(__proto, '${f.name}', () => ${fn(f.name)}, (v) => { ${fn(f.name)} = v; });`),
        ``,
        `const ${NS} = Object.create(__proto);`,
        // Reading a global goes through $B.resolve_global → resolve_in_namespace,
        // which demands an *own* property unless the namespace is flagged
        // $proxy — in which case it reads the property normally and therefore
        // walks the prototype chain, where our accessors live. It is the only
        // place in Brython that consults this flag.
        `${NS}.$proxy = true;`,
        // publish("items") gives back a rendering-visible identity after an
        // in-place mutation, so `{#each items}` keeps working without the
        // component having to maintain a parallel published value.
        ...(hasPublish
            ? []
            : [
                  ``,
                  `const __publish = (key) => { ${NS}[key] = republish(${NS}[key]); };`,
                  `bind(__proto, 'publish', () => __publish, () => {});`
              ]),
        ``,
        `init(${NS});`,
        ``,
        // Event handlers are called with a DOM event Python never asked for.
        // Truncating to the declared arity is a placeholder for a real interop
        // policy (jsobj2pyobj on demand) — enough to make handlers work.
        // An uncaught Python exception arrives in JS without message or stack;
        // pyError fills them in, naming the function and the file it came from.
        ...funcs.map(
            (f) =>
                `const ${f.name} = (...a) => { try { return ${fn(f.name)}(...a.slice(0, ${f.arity})); }` +
                ` catch (err) { throw pyError(err, ${JSON.stringify(`${f.name}() — ${source}`)}); } };`
        ),
        ...(store
            ? [
                  ``,
                  // Module-scope signals live once for the whole app. Exported
                  // through getters because Svelte forbids exporting a reassigned
                  // $state binding directly — and a getter is what keeps the read
                  // reactive at the call site.
                  `export const store = {`,
                  ...state.map((n) => `    get ${n}() { return ${n}; },`),
                  ...state.map((n) => `    set ${n}(v) { ${n} = v; },`),
                  ...funcs.map((f) => `    ${f.name},`),
                  `};`,
                  ``,
                  `export default store;`
              ]
            : []),
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
                                ` catch (err) { throw pyError(err, ${JSON.stringify(`on_destroy() — ${source}`)}); } };`
                        ]
                      : []),
                  `});`
              ]
            : [])
    ].join('\n');

    // Only the modules this component actually imports reach the browser.
    const stdlib = needsStdlib
        ? [
              `import 'svelthon/runtime';`,
              ``,
              `__BRYTHON__.use_VFS = true;`,
              `__BRYTHON__.update_VFS(${JSON.stringify(vfs)});`
          ].join('\n')
        : null;

    return { script, module, stdlib, imports: Object.keys(root.imports) };
}

const VIRTUAL_PREFIX = 'virtual:svelthon/';
const VFS_PREFIX = 'virtual:svelthon-vfs/';

const virtualId = (name) => VIRTUAL_PREFIX + name;
const vfsId = (name) => VFS_PREFIX + name;

module.exports = { compile, VIRTUAL_PREFIX, VFS_PREFIX, virtualId, vfsId };
