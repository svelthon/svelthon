// Brython without its parsing chain: a Svelthon page runs code compiled ahead
// of time and never parses Python. What does is `compile.cjs`, which takes the
// chain itself, so a route that compiles pays for it and no other does.
//
// Imported here and not left to the order of `runtime.js`. The engine is a
// CommonJS file, so a bundler wraps it in a lazy initialiser and places the call
// where the binding is used rather than where the import sits: read from a
// neighbour, that call lands *after* this file and `$B.brython` is undefined.
// Naming the dependency where it is needed is what keeps the order.
import '../../../vendor/brython_runtime.js';

// Initialise the runtime once per page. `ipy_id: []` keeps brython() from
// scanning the document for <script type="text/python">: Svelthon components
// are already compiled, there is nothing left to find.
const $B = globalThis.__BRYTHON__;

// globals.js shadowed `process` so that brython.js would see the DOM jsdom
// provides rather than the Node process behind it. Its load is over.
if ($B.$bryntimeRealProcess) {
    globalThis.process = $B.$bryntimeRealProcess;
    delete $B.$bryntimeRealProcess;
}

// What brython.js adds to the global scope when it finds no browser.
const DOM_STUBS = new Set(['document', 'location', 'HTMLElement', 'MutationObserver', 'customElements']);

if (!$B.$bryntimeBooted) {
    $B.$bryntimeBooted = true;
    $B.brython({ ipy_id: [] });

    // Server rendering must look like server rendering. Brython's DOM stubs did
    // their job during the bootstrap above; leaving them in place makes every
    // library that tests `typeof document` take the browser path and fail on
    // `window`. See the note in globals.js.
    const before = $B.$bryntimeGlobalsBefore;

    if (before && !before.has('window')) {
        for (const name of Object.getOwnPropertyNames(globalThis)) {
            if (!before.has(name) && DOM_STUBS.has(name)) delete globalThis[name];
        }
    }
}
