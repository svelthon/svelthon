// Brython is a classic browser script, loaded here as an ES module. Two things
// differ in that context and both must be settled *before* brython.js runs,
// hence a separate module, since ES imports are hoisted above statements.
//
//  - `document.currentScript` is null in a module, and brython.js dereferences
//    it to derive its own install path. Setting brython_path skips that branch
//    (build/brython.js:38).
//  - the codegen builds its AST classes with eval(), whose code resolves `$B`
//    in *global* scope; a module-scoped binding would be invisible to it.
// Server-side rendering runs this same module under Node, where the bootstrap
// finds neither of these. brython.js shims `document` itself when it is absent,
// but not these two.
globalThis.self ??= globalThis;
globalThis.addEventListener ??= () => {};

// brython_path must be an absolute URL: $B.strip_host feeds it to new URL().
const base = globalThis.location?.href ?? 'http://localhost/';

globalThis.__BRYTHON__ ??= { brython_path: new URL('/brython/', base).href };
globalThis.$B = globalThis.__BRYTHON__;

// Under Node, brython.js installs its own `document`, `location`, `HTMLElement`,
// `MutationObserver` and `customElements`, stubs its bootstrap needs, with three
// keys between them. They are also a trap: half the ecosystem decides it is in a
// browser with `typeof document !== "undefined"`, then reaches for `window`,
// which nothing defines. Bits UI does exactly that and takes server rendering
// down with a bare `ReferenceError: window is not defined`.
//
// So the names present before Brython loads are recorded here, and boot.js
// removes whatever it added, but only off a real browser, where these globals
// belong to the page and are none of our business.
globalThis.$B.$svelthonGlobalsBefore ??= new Set(Object.getOwnPropertyNames(globalThis));

// brython.js splits itself in two at load time and picks a half from the process
// alone: `isNode = typeof process !== 'undefined' && process.release.name ===
// 'node'` (build/brython.js:16). The browser half is what builds `browser.html`,
// the module `$B.get_class` reads to give a DOM node its Python class; the Node
// half never defines it, and `node.value` from Python then dies inside
// `get_dict` on an undefined module.
//
// jsdom is the case where the question and its test disagree: it provides a DOM
// *and* a Node process. What brython.js means to ask is whether a DOM exists, so
// that is the question answered here, by shadowing the process object for the
// length of the load with one that inherits everything except the name being
// tested. boot.js puts the real one back.
if (globalThis.document && globalThis.process?.release?.name === 'node') {
    const real = globalThis.process;
    const shadow = Object.create(real);

    Object.defineProperty(shadow, 'release', { value: { ...real.release, name: 'jsdom' } });

    globalThis.$B.$svelthonRealProcess = real;
    globalThis.process = shadow;
}
