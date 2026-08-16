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

// Name the generated module gives to the reactive namespace it receives.
const NS = '__py';

// Brython emits module state into a namespace object:
//     locals_Counter = $B.namespace('Counter')
//     locals_Counter.count = 0
// Nothing lives in a lexical binding, so there is a single object to intercept.
const NAMESPACE_DECL = /(locals_\w+) = \$B\.namespace\((['"]).*?\2\)/;

// Module-level names, read off the AST rather than the generated JS — the
// codegen mangles function names (`increment941818`) but the AST has the truth.
function surface(body) {
    const state = [];
    const funcs = [];

    for (const node of body) {
        if (node instanceof $B.ast.Assign) {
            for (const target of node.targets) {
                if (target instanceof $B.ast.Name) state.push(target.id);
            }
        } else if (node instanceof $B.ast.AnnAssign) {
            if (node.target instanceof $B.ast.Name) state.push(node.target.id);
        } else if (node instanceof $B.ast.FunctionDef) {
            funcs.push({ name: node.name, arity: (node.args && node.args.args || []).length });
        }
    }

    return { state, funcs };
}

function compile(src, name = 'Component') {
    // The namespace identifier is derived from `filename` alone — `module` and
    // `locals_id` are ignored by js_from_root. Brython maps '.' to '_' but
    // leaves '/' alone, so a real path would emit `locals_src/Counter_svelte`,
    // which is not valid JavaScript. Pass an identifier-safe name instead; the
    // cost is that Python's __file__ says "Counter" rather than the full path.
    const root = $B.py2js({ src, filename: name }, name, [name]);
    const js = root.to_js();
    const { state, funcs } = surface(root._ast.body);

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
    const module = [
        `import 'svelthon/runtime';`,
        ``,
        `export function init(${NS}) {`,
        body,
        `}`
    ].join('\n');

    const script = [
        `import { init } from ${JSON.stringify(virtualId(name))};`,
        ``,
        `let ${NS} = $state({});`,
        `init(${NS});`,
        ``,
        // Republish the namespace as component-level bindings so templates can
        // say {count} instead of {__py.count}. Reads go through the proxy, so
        // they stay reactive; writes only ever happen on the Python side.
        ...state.map((n) => `let ${n} = $derived(${NS}.${n});`),
        // Event handlers are called with a DOM event Python never asked for.
        // Truncating to the declared arity is a placeholder for a real interop
        // policy (jsobj2pyobj on demand) — enough to make handlers work.
        ...funcs.map((f) => `const ${f.name} = (...a) => ${NS}.${f.name}(...a.slice(0, ${f.arity}));`)
    ].join('\n');

    return { script, module, imports: Object.keys(root.imports) };
}

const VIRTUAL_PREFIX = 'virtual:svelthon/';

const virtualId = (name) => VIRTUAL_PREFIX + name;

module.exports = { compile, VIRTUAL_PREFIX, virtualId };
