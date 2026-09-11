import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { test, expect, describe } from 'vitest';
import '../src/lib/runtime.js';

// Behaviours of the vendored Brython that Svelthon rests on, each observable,
// so a build that loses one turns a test red rather than a page. Most are
// upstream; the last two are the local edits, which a re-vendoring drops.
describe('the vendored Brython carries its repairs', () => {
    const $B = globalThis.__BRYTHON__;

    // `js.Response.new(body, {"headers": {...}})` — any Web API taking a WebIDL
    // record refuses an own symbol key, so the back-reference from a converted
    // container to its Python object lives in a WeakMap rather than on the
    // container.
    test('a converted container carries no symbol key', () => {
        const dict = $B.builtins.dict.$factory();
        $B.$setitem(dict, 'content-type', 'application/json');

        const converted = $B.pyobj2jsobj(dict);

        expect(Object.getOwnPropertySymbols(converted)).toHaveLength(0);
        expect($B.PYOBJ_MAP).toBeInstanceOf(WeakMap);
    });

    // What the map is for: the same Python object comes back, not a copy.
    test('and still comes back as the object it was', () => {
        const dict = $B.builtins.dict.$factory();
        const converted = $B.pyobj2jsobj(dict);

        expect($B.PYOBJ_MAP.has(converted)).toBe(true);
        expect($B.jsobj2pyobj(converted)).toBe(dict);
    });

    // A list too, and `jsobj2pyobj` has to consult the map before answering an
    // array, or a converted one comes back as a bare `JavascriptArray`.
    //
    // It shows through a dict rather than on its own, because a converted dict
    // keeps its JavaScript view and reads through it from then on: one call
    // into JavaScript with a dict would leave every nested list in the caller's
    // own value stripped of its class, `.index()` gone, slicing gone,
    // `isinstance(x, list)` false.
    test('a list comes back as the list it was', () => {
        const _b_ = $B.builtins;
        const rows = _b_.list.$factory([1, 2]);
        const dict = _b_.dict.$factory();

        $B.$setitem(dict, 'rows', rows);
        $B.pyobj2jsobj(dict);

        expect($B.$getitem(dict, 'rows')).toBe(rows);
        expect($B.class_name($B.$getitem(dict, 'rows'))).toBe('list');
    });

    // A debug print here fires on every attribute access on a JavaScript class
    // from Python, so two requests through `js.` fill a server log.
    test('no debug print in JSClass.tp_getattro', () => {
        expect(String($B.JSClass.tp_getattro)).not.toContain('console.log');
    });

    // `str.find` has to convert its `start`: it counts code points and
    // `indexOf` counts UTF-16 units, so an emoji before `start` moves the search
    // backwards and the same match comes back for ever. The tutorial's prose
    // scanner walks rendered HTML with exactly the loop below.
    test('str.find honours its start argument past an astral character', () => {
        // `$B.String` is the factory the compiler emits for a literal: it is
        // what records where the surrogate pairs are. A bare JavaScript string
        // carries none, and would not exercise the conversion at all.
        const find = (text, sub, start) => $B.$getattr(text, 'find')(sub, start);

        // 'a', an emoji, 'b', 'X', 'b', 'X' — the second X is at 5 in Python
        // and at 6 in JavaScript.
        const s = $B.String('a\u{1f600}bXbX');

        expect(find(s, 'X', 0)).toBe(3);
        expect(find(s, 'X', 4)).toBe(5);

        // The loop that goes endless without the conversion.
        let at = find(s, 'X', 0);
        const seen = [];
        while (at !== -1 && seen.length < 4) {
            seen.push(at);
            at = find(s, 'X', at + 1);
        }

        expect(seen).toEqual([3, 5]);
    });

    // Under Node the compiler loads the file with `require()` and a
    // server-rendered component imports it again, which are two module
    // instances; the wrapper skips the body on the second. Local, and it would
    // be wrong upstream: a browser loads the script once per page, so the guard
    // protects nothing there while changing the shape of the file for everyone.
    //
    // Loading it again is what the test does, so the sentinel is read for what
    // it is: the same `$B` object has to come back, not a rebuilt one.
    test('a second execution is refused', () => {
        const before = $B.builtins;

        createRequire(import.meta.url)('../vendor/brython.js');

        expect(globalThis.__BRYTHON__).toBe($B);
        expect(globalThis.__BRYTHON__.builtins).toBe(before);
    });

    // The other local edit, and the one with nothing observable at run time to
    // hang a test on: it silences a Vite warning. So the file is read as text.
    //
    // Two, and only the real dynamic imports: `$B.$import(...)` is Brython's own
    // function and `vite:import-analysis` never looks at it, however much
    // `$B.$import(` looks like `import(`. Measured on the dev server, removing
    // both gives exactly two warnings, at the two sites below.
    test('the two real dynamic imports are the only ones marked', () => {
        // Relative to the working directory, not to `import.meta.url`: this
        // file runs under jsdom, where that is an http URL and `readFileSync`
        // refuses it. The other source-reading tests are node-environment.
        const source = readFileSync('vendor/brython.js', 'utf8');

        expect(source.match(/@vite-ignore/g)).toHaveLength(2);
        expect(source).toContain('import(/* @vite-ignore */ ref)');
        expect(source).toContain('import(/* @vite-ignore */ refs[0])');
    });
});
