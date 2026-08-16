// Initialise the runtime once per page. `ipy_id: []` keeps brython() from
// scanning the document for <script type="text/python"> — SVELTHON components
// are already compiled, there is nothing left to find.
const $B = globalThis.__BRYTHON__;

if (!$B.$svelthon_booted) {
    $B.$svelthon_booted = true;
    $B.brython({ ipy_id: [] });
}

// Traversing a DOM node from Python (`event.target.value`) needs
// `$B.imported['browser.html']`, which picks a node's Python class from its
// tagName. It ships inside brython.js but is only registered by a real `import`,
// and $B.$import cannot run here — it reads $B.frame_obj, null until a module
// body executes. A component that needs it writes `from browser import html`.
