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
// Nothing lives in a lexical binding, so there is a single object to intercept.
const NAMESPACE_DECL = /(locals_\w+) = \$B\.namespace\((['"]).*?\2\)/;

// Python identifiers that JavaScript will not accept as bindings. They stay
// perfectly usable inside the component's Python; they simply are not published
// to the template.
const JS_RESERVED = new Set(`break case catch class const continue debugger default delete do else
enum export extends false function if implements in instanceof interface let new null package
private protected public return static super switch this throw true typeof var void while with
yield arguments eval`.split(/\s+/));

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

function compile(src, name = 'Component') {
    // The namespace identifier is derived from `filename` alone — `module` and
    // `locals_id` are ignored by js_from_root. Brython maps '.' to '_' but
    // leaves '/' alone, so a real path would emit `locals_src/Counter_svelte`,
    // which is not valid JavaScript. Pass an identifier-safe name instead; the
    // cost is that Python's __file__ says "Counter" rather than the full path.
    const root = $B.py2js({ src, filename: name }, name, [name]);
    const js = root.to_js();
    const { props, state, funcs } = surface(root._ast.body);

    if (!NAMESPACE_DECL.test(js)) {
        throw new Error(`svelthon: no Brython namespace found in the code generated for ${name}`);
    }

    // The whole trick, in one substitution: give Brython a $state proxy instead
    // of a plain namespace, and every assignment its codegen already emits
    // becomes a reactive write. The Python source stays plain Python.
    // (A function replacer, so a '$' in NS is not read as a capture reference.)
    const body = js.replace(NAMESPACE_DECL, (_match, binding) => `${binding} = ${NS}`);

    // Svelte reserves the '$' prefix for *every* scope inside a component, and
    // Brython's codegen opens with `var $B = __BRYTHON__`. So the generated
    // code lives in its own module, which Svelte never parses.
    const vfs = stdlibClosure(Object.keys(root.imports));
    const needsStdlib = Object.keys(vfs).length > 0;

    const module = [
        `import 'svelthon/runtime';`,
        ...(needsStdlib ? [`import ${JSON.stringify(vfsId(name))};`] : []),
        ``,
        `export function init(${NS}) {`,
        body,
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
    const fn = (name) => `__fn_${name}`;
    const local = (name) => `__local_${name}`;

    const script = [
        `import { init } from ${JSON.stringify(virtualId(name))};`,
        `import { bind, NONE } from 'svelthon/runtime';`,
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
        ...props.map((n) => `bind(__proto, '${n}', () => ${n}, (v) => { ${local(n)} = v; });`),
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
        ``,
        `init(${NS});`,
        ``,
        // Event handlers are called with a DOM event Python never asked for.
        // Truncating to the declared arity is a placeholder for a real interop
        // policy (jsobj2pyobj on demand) — enough to make handlers work.
        ...funcs.map((f) => `const ${f.name} = (...a) => ${fn(f.name)}(...a.slice(0, ${f.arity}));`)
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
