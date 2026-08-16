// Brython is a classic browser script, loaded here as an ES module. Two things
// differ in that context and both must be settled *before* brython.js runs —
// hence a separate module, since ES imports are hoisted above statements.
//
//  - `document.currentScript` is null in a module, and brython.js dereferences
//    it to derive its own install path. Setting brython_path skips that branch
//    (vendor/brython.js:38).
//  - the codegen builds its AST classes with eval(), whose code resolves `$B`
//    in *global* scope; a module-scoped binding would be invisible to it.
// brython_path must be an absolute URL: $B.strip_host feeds it to new URL().
const base = globalThis.location?.href ?? 'http://localhost/';

globalThis.__BRYTHON__ ??= { brython_path: new URL('/brython/', base).href };
globalThis.$B = globalThis.__BRYTHON__;
