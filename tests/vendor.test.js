import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { test, expect, describe } from 'vitest';
import '../src/lib/runtime.js';

// Behaviours of the vendored Brython that Svelthon rests on, each observable,
// so a build that loses one turns a test red rather than a page. The first
// group is upstream; then come the commits still waiting there, which a
// re-vendoring from plain master drops; the last two are the edits made in the
// built file, which every re-vendoring drops.
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

    // `None` and `undefined` are one value seen from two sides. Every value an
    // author hands to a JavaScript function, and every value one hands back,
    // crosses these two: without the pairing a function that returns nothing
    // gives `<Javascript undefined>`, which is not `None` and answers no
    // comparison an author would write.
    test('None and undefined convert into each other', () => {
        expect($B.jsobj2pyobj(undefined)).toBe($B.builtins.None);
        expect($B.pyobj2jsobj($B.builtins.None)).toBe(undefined);
    });

    // A raw `undefined` still reaches Python from a JavaScript object nobody
    // converted, and printing one is the first thing anybody does with a value
    // that surprised them. Without the slot `str()` raises about a descriptor
    // called with no argument, which names nothing the author wrote.
    test('str() of a JavaScript undefined answers', () => {
        expect($B.builtins.str.$factory(undefined)).toBe('<Javascript undefined>');
    });

    // `javascript.JSON` and the `json` module have to agree on an integer past
    // 2^53. They did not: `stringify` raised on the BigInt, and `parse` handed
    // back an `int` whose last digits were wrong, silently, because
    // `Number.isInteger` is true of the double. The repair carries the digits
    // of the literal across instead of its value.
    test('javascript.JSON reads and writes a large integer exactly', () => {
        const JSON_ = $B.$getattr($B.imported.javascript, 'JSON');
        const digits = '12345678901234567890123';

        const row = $B.builtins.dict.$factory();
        $B.$setitem(row, 'n', BigInt(digits));

        expect($B.$getattr(JSON_, 'stringify')(row)).toBe(`{"n":${digits}}`);

        const back = $B.$getitem($B.$getattr(JSON_, 'parse')(`{"n": ${digits}}`), 'n');
        expect(back).toBe(BigInt(digits));
        expect($B.class_name(back)).toBe('int');

        // And nothing else is touched: an integer a double holds exactly stays
        // a number, so no existing value changes shape.
        expect(typeof $B.$getitem($B.$getattr(JSON_, 'parse')('{"n": 1}'), 'n')).toBe('number');
    });

    // Every Javascript number crossing to Python passes here, and a whole one
    // above 2^53 was built from `jsobj.toString()`: the shortest decimal that
    // reads back as the double, which is another integer, and exponential
    // notation from 1e21 up, which `BigInt()` refuses outright. `from_json`
    // reaches this on any large integer in a JSON document.
    test('a whole Javascript number above 2^53 crosses as the int it is', () => {
        expect($B.jsobj2pyobj(2 ** 60)).toBe(1152921504606846976n);
        expect($B.jsobj2pyobj(1e21)).toBe(10n ** 21n);
        expect($B.jsobj2pyobj(2 ** 70)).toBe(2n ** 70n);
        expect($B.jsobj2pyobj(-(2 ** 70))).toBe(-(2n ** 70n));

        // Below the boundary nothing becomes a BigInt, and a fraction is still
        // a Python float rather than an int.
        expect($B.jsobj2pyobj(1e15)).toBe(1e15);
        expect($B.class_name($B.jsobj2pyobj(0.5))).toBe('float');
    });

    // The module name and the filename are written into four literals of every
    // generated module: the namespace, the frame, `__file__` and `__name__`.
    // Pasted between quotes, a filename holding one closed its literal, and the
    // module compiled to JavaScript that does not parse — `O'Brien.py` is a
    // legal filename, and the Python in it was valid. Measured on a bundle built
    // from plain master: `JavascriptError: Unexpected identifier 'Brien'`.
    //
    // Read off the generator rather than run: the parser lives in the other
    // bundle, so nothing here can compile a module. The same reading as the
    // debug print above, and `tests/source-path.test.js` is the behaviour, end
    // to end, through the compiler.
    test('the generated module literals are escaped, not pasted', () => {
        const source = String($B.ast.Module.prototype.to_js);

        expect(source).toContain('JSON.stringify(module_id)');
        expect(source).toContain('JSON.stringify(scopes.filename');
        expect(source).toContain('JSON.stringify(name)');
        expect(source).not.toContain("namespace('${module_id}')");
    });

    // The other half of the same name. The generator declares the module's
    // wrapper as `locals_<name>` with every character an identifier cannot hold
    // replaced; the importer built the same identifier with `.` alone replaced,
    // so the two disagreed on anything else and `new Function` answered `Arg
    // string terminates parameters early`. One rule now, exported and shared,
    // which is the whole point: a second spelling is what the defect was.
    // The sites themselves are inside `run_py`, a function the importer keeps to
    // itself, so they are counted in the file: one definition and five callers,
    // which is what "one rule" means here. Reading `String($B.$import)` looked
    // like the stronger test and was the emptier one — the text is not in that
    // function at all, so the assertion could not have failed.
    test('the identifier rule is one function, not one per site', () => {
        const source = readFileSync('vendor/brython_runtime.js', 'utf8');

        expect($B.scope_name("O'Brien")).toBe('O_Brien');
        expect($B.scope_name('a.b')).toBe('a_b');
        expect(source.match(/\$B\.scope_name\(/g)).toHaveLength(5);
    });

    // Under Node the compiler loads the file with `require()` and a
    // server-rendered component imports it again, which are two module
    // instances; the wrapper skips the body on the second. Local, and it would
    // be wrong upstream: a browser loads the script once per page, so the guard
    // protects nothing there while changing the shape of the file for everyone.
    //
    // Loading it again is what the test does, so the sentinel is read for what
    // it is: the same `$B` object has to come back, not a rebuilt one. The file
    // asked for is the one the package ships, which is also the one already
    // loaded here, so this is the real collision rather than a stand-in.
    test('a second execution is refused', () => {
        const before = $B.builtins;

        createRequire(import.meta.url)('../vendor/brython_runtime.js');

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
        const source = readFileSync('vendor/brython_runtime.js', 'utf8');

        expect(source.match(/@vite-ignore/g)).toHaveLength(2);
        expect(source).toContain('import(/* @vite-ignore */ ref)');
        expect(source).toContain('import(/* @vite-ignore */ refs[0])');
    });
});
