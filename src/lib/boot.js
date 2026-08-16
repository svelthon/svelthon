// Initialise the runtime once per page. `ipy_id: []` keeps brython() from
// scanning the document for <script type="text/python"> — SVELTHON components
// are already compiled, there is nothing left to find.
const $B = globalThis.__BRYTHON__;

if (!$B.$svelthon_booted) {
    $B.$svelthon_booted = true;
    $B.brython({ ipy_id: [] });
}
