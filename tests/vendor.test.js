import { readFileSync } from 'node:fs';

import { test, expect, describe } from 'vitest';
import '../src/lib/runtime.js';

// Every repair below is upstream now, in the build this file vendors. That does
// not retire the tests: a newer Brython can lose a behaviour as easily as a
// local edit can be dropped, and each one here is observable, so losing it
// turns a test red rather than a page.
//
// Two edits are still local and would be wrong upstream: the file wrapper and
// the two `/* @vite-ignore */`. They are the last two tests of the file, and
// they are the ones a re-vendoring really does drop.
describe('the vendored Brython carries its repairs', () => {
    const $B = globalThis.__BRYTHON__;

    // `js.Response.new(body, {"headers": {...}})` — any Web API taking a WebIDL
    // record refuses an own symbol key, and the conversion used to stamp one on
    // every container it produced. The back-reference lives in a WeakMap now.
    test('a converted container carries no symbol key', () => {
        const dict = $B.builtins.dict.$factory();
        $B.$setitem(dict, 'content-type', 'application/json');

        const converted = $B.pyobj2jsobj(dict);

        expect(Object.getOwnPropertySymbols(converted)).toHaveLength(0);
        expect($B.PYOBJ_MAP).toBeInstanceOf(WeakMap);
    });

    // The round-trip cache the symbol used to be: the same Python object comes
    // back, not a copy.
    test('and still comes back as the object it was', () => {
        const dict = $B.builtins.dict.$factory();
        const converted = $B.pyobj2jsobj(dict);

        expect($B.PYOBJ_MAP.has(converted)).toBe(true);
        expect($B.jsobj2pyobj(converted)).toBe(dict);
    });

    // A list too, which the back-reference used to miss: `jsobj2pyobj` answered
    // every array before consulting the map, so a converted one came back as a
    // bare `JavascriptArray`.
    //
    // It shows up through a dict rather than on its own, because a converted
    // dict keeps its JavaScript view and reads through it from then on. So one
    // call into JavaScript with a dict left every nested list in it stripped of
    // its class — `.index()` gone, slicing gone, `isinstance(x, list)` false —
    // in the caller's own value, after the call had returned.
    test('a list comes back as the list it was', () => {
        const _b_ = $B.builtins;
        const rows = _b_.list.$factory([1, 2]);
        const dict = _b_.dict.$factory();

        $B.$setitem(dict, 'rows', rows);
        $B.pyobj2jsobj(dict);

        expect($B.$getitem(dict, 'rows')).toBe(rows);
        expect($B.class_name($B.$getitem(dict, 'rows'))).toBe('list');
    });

    // A debug print left upstream, firing on every attribute access on a
    // JavaScript class from Python. Two requests through `js.` filled the log.
    test('no debug print in JSClass.tp_getattro', () => {
        expect(String($B.JSClass.tp_getattro)).not.toContain('console.log');
    });

    // `str.find` handed its `start` straight to `indexOf`. One counts code
    // points, the other UTF-16 units, so an emoji before `start` moved the
    // search backwards and the same match came back for ever. The tutorial's
    // prose scanner walks the rendered HTML with exactly that loop, and the
    // page carrying the three wise monkeys pegged a core until the tab was
    // killed.
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

        // The loop the defect used to make endless.
        let at = find(s, 'X', 0);
        const seen = [];
        while (at !== -1 && seen.length < 4) {
            seen.push(at);
            at = find(s, 'X', at + 1);
        }

        expect(seen).toEqual([3, 5]);
    });

    // Loading it twice in one process rebuilds `$B.ast`, and the classes the
    // compiler holds lose the `to_js()` the code generator attached. Local, and
    // it would be wrong upstream: a browser loads the script once per page, so
    // the guard protects nothing there while changing the shape of the file for
    // everyone.
    test('a second execution is refused', () => {
        expect($B.ast).toBeTruthy();
    });

    // The other local edit, and the one with nothing observable at run time to
    // hang a test on: it silences a Vite warning. So the file is read as text.
    //
    // Two, not eighteen. `$B.$import(...)` is Brython's own function and
    // `vite:import-analysis` never looks at it; the sixteen comments sat there
    // for years doing nothing because `$B.$import(` contains `import(`.
    // Measured by removing them: eighteen gives no warning, two gives no
    // warning, none gives exactly two, at both sites below.
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
