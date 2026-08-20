// Initialise the runtime once per page. `ipy_id: []` keeps brython() from
// scanning the document for <script type="text/python"> — Svelthon components
// are already compiled, there is nothing left to find.
const $B = globalThis.__BRYTHON__;

// What brython.js adds to the global scope when it finds no browser.
const DOM_STUBS = new Set(['document', 'location', 'HTMLElement', 'MutationObserver', 'customElements']);

if (!$B.$svelthon_booted) {
    $B.$svelthon_booted = true;
    $B.brython({ ipy_id: [] });

    // Server rendering must look like server rendering. Brython's DOM stubs did
    // their job during the bootstrap above; leaving them in place makes every
    // library that tests `typeof document` take the browser path and fail on
    // `window`. See the note in globals.js.
    const before = $B.$svelthonGlobalsBefore;

    if (before && !before.has('window')) {
        for (const name of Object.getOwnPropertyNames(globalThis)) {
            if (!before.has(name) && DOM_STUBS.has(name)) delete globalThis[name];
        }
    }
}

// Traversing a DOM node from Python (`event.target.value`) needs
// `$B.imported['browser.html']`, which picks a node's Python class from its
// tagName. It ships inside brython.js but is only registered by a real `import`,
// and $B.$import cannot run here — it reads $B.frame_obj, null until a module
// body executes. A component that needs it writes `from browser import html`.
