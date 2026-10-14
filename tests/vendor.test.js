import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import v8 from 'node:v8';
import { runInNewContext } from 'node:vm';

import { test, expect, describe, vi } from 'vitest';
import '../src/lib/runtime.js';
import { mount, flushSync, settled } from './mounted.js';
import CoroutineAwaited from './fixtures/CoroutineAwaited.svelte';
import ComprehensionAwait from './fixtures/ComprehensionAwait.svelte';
import * as deleteOrder from './fixtures/delete_order.py';
import * as strKeywords from './fixtures/str_keywords.py';
import * as jsonText from './fixtures/json_text.py';
import * as deletedGlobal from './fixtures/deleted_global.py';
import * as templateStrings from './fixtures/template_strings.py';

// Behaviours of the vendored Brython that Svelthon rests on, each observable,
// so a build that loses one turns a test red rather than a page. The first
// group is upstream; then come the commits still waiting there, which a
// re-vendoring from plain master drops; the integer format and the `__call__`
// binding are edits made in the built file, which every re-vendoring drops.
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

    // The engine's own conversion of a list is a copy JavaScript may change,
    // so the copy is not read back as the list: Brython's test 2474 appends to
    // it from both sides. What the runtime hands over is its own view, mapped.
    test('a copy of a list made by the engine is not mapped back to it: list-copy-not-mapped', () => {
        const hook = $B.pyobj2jsobj_hook;
        $B.pyobj2jsobj_hook = undefined;

        try {
            const copy = $B.pyobj2jsobj($B.builtins.list.$factory([1, 2]));

            expect($B.PYOBJ_MAP.has(copy)).toBe(false);
            expect($B.jsobj2pyobj(copy)).toBe(copy);
        } finally {
            $B.pyobj2jsobj_hook = hook;
        }
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

    // A quote used as the **fill character** of a format specification. A string
    // constant reaches the code generator escaped when it came from a source
    // literal and raw when it came from a specification, so `f"{3:'>5}"` pasted
    // a bare apostrophe into the emitted literal and the generated JavaScript
    // stopped parsing. CPython 3.14.4 prints the right-hand value.
    test('an f-string format specification may be filled with a quote', () => {
        const _b_ = $B.builtins;
        const format = (spec, value) =>
            $B.$call($B.$getattr(_b_.str, 'format'), `{0:${spec}}`, value);

        expect(format("'>5", 3)).toBe("''''3");
        expect(format('#x', 255)).toBe('0xff');
        expect(format('>5', 1)).toBe('    1');
    });

    // An int of 2^53 or more is held as a BigInt, and a float format
    // specification asked for it went through `fast_float`, which wraps the
    // value without converting: the arithmetic inside `float.__format__` then
    // raised `JavascriptError: Cannot convert a BigInt value to a number`. Not a
    // Python exception, so `except (ValueError, TypeError)` does not catch it,
    // and the message names `BigInt`, a word absent from the program the author
    // wrote. `nb_float` is the conversion, and it keeps CPython's own
    // `OverflowError` for an int too large to be a float.
    //
    // The boundary is exactly 2^53: the values below are CPython 3.14.4's.
    // Found while enumerating what a JavaScript value becomes on each of the two
    // doors into a store, which is a place no int of this size ever goes — the
    // refusal is Brython's, with no boundary of ours anywhere near it.
    test('an int of 2^53 or more takes a float format specification', () => {
        const _b_ = $B.builtins;
        const format = (spec, value) =>
            $B.$call($B.$getattr(_b_.str, 'format'), `{0:${spec}}`, value);
        const big = $B.fast_int ? $B.fast_int(BigInt('9007199254740992')) : BigInt('9007199254740992');

        expect(format('.2f', big)).toBe('9007199254740992.00');
        expect(format('.2e', big)).toBe('9.01e+15');
        expect(format('.2G', big)).toBe('9E+15');
        // The integer specifications never went through the float path and are
        // here so a repair on one side cannot quietly move the other.
        expect(format('d', big)).toBe('9007199254740992');
        expect(format('.2f', 9007199254740991)).toBe('9007199254740991.00');
    });

    // `"ob_type"` is the mirror of the key below, and the second name the same
    // predicate has to refuse. It *does* become an own property, and shadows the
    // one the engine reads to know what the object is: the dictionary answered a
    // string for its own class, and the next assignment raised `'undefined'
    // object does not support item assignment` on a dictionary that had been
    // valid a line earlier.
    //
    // Measured on 22 candidate names; this is the only one that collides.
    test('a dict keeps an entry whose key is ob_type', () => {
        const _b_ = $B.builtins;
        const d = _b_.dict.$factory();

        $B.$setitem(d, 'ob_type', 'business');
        $B.$setitem(d, 'value', 42);

        expect($B.$getitem(d, 'ob_type')).toBe('business');
        expect($B.$getitem(d, 'value')).toBe(42);
        expect(_b_.len(d)).toBe(2);

        // Still a dict afterwards, which is the half the collision destroyed:
        // `is_dict` answers a flag rather than a boolean, so it is read as one.
        expect(Boolean($B.is_dict(d))).toBe(true);
    });

    // `"__proto__"` is a string like any other in Python. The fast path for a
    // string key is `d[key] = value`, which reaches the accessor on
    // `Object.prototype`: the entry never became an own property, the value
    // became the dictionary's own prototype, and the key was gone — `in` said
    // false and reading it raised `KeyError` on a key that had been written.
    //
    // Measured against CPython 3.14.4, which answers the right-hand column.
    test('a dict keeps an entry whose key is __proto__', () => {
        const _b_ = $B.builtins;
        const d = _b_.dict.$factory();

        $B.$setitem(d, '__proto__', 1);
        $B.$setitem(d, 'kept', 2);

        expect($B.$getitem(d, '__proto__')).toBe(1);
        expect(_b_.len(d)).toBe(2);
        expect([..._b_.list.$factory(d)]).toEqual(['__proto__', 'kept']);
        expect(Object.getPrototypeOf(d)).toBe(Object.prototype);

        // And an ordinary dict still takes the fast path it is there for.
        const plain = _b_.dict.$factory();

        $B.$setitem(plain, 'a', 1);

        expect(Object.hasOwn(plain, 'a')).toBe(true);
    });

    // An `__iter__` that returns something other than an iterator is refused
    // with a `TypeError`, and nothing else: the two debug prints on that path
    // dumped the object and its class to the console, once per refusal. The same
    // shape as the one in `JSClass.tp_getattro`, read the same way.
    test('no debug print where iter() refuses a non-iterator', () => {
        const source = String($B.$iter);

        expect(source).toContain('returned non-iterator of type');
        expect(source).not.toContain("console.log('iter, obj'");
        expect(source).not.toContain('no tp_iternext in');
    });

    // The sign comes before the base prefix, and a zero fill goes after both:
    // CPython's answers, checked with `python3`. The prefix was glued in front
    // of a string that already carried the sign, `0x-f`, and the `=` alignment
    // of a `0` fill put the zeros in front of the prefix, `00xf`.
    test.for([
        [15, '#04x', '0x0f'],
        [-15, '#x', '-0xf'],
        [-15, '#07x', '-0x000f'],
        [15, '#08b', '0b001111'],
        [8, '#06o', '0o0010'],
        [255, '#06X', '0X00FF'],
        [15, '+#06x', '+0x00f'],
        [-(2n ** 60n), '#x', '-0x1000000000000000'],
        [-15, '05d', '-0015']
    ])('format(%s, %j) is %j', ([value, spec, answer]) => {
        expect($B.$getattr(value, '__format__')(spec)).toBe(answer);
    });

    // A `__call__` that is not a function is bound through its `__get__`
    // first, as CPython's `slot_tp_call` does: a `@classmethod def __call__`
    // gets the class. It raised `object is not callable`. A direct edit of the
    // built file, which a revendoring erases: this row says so.
    test('a classmethod __call__ is bound before it is called', () => {
        expect(String($B.$call)).toContain("search_slot($B.get_class(call_method),'tp_descr_get'");
    });

    // The engine's own conversion of a Python callable, behind the hook: a
    // callable instance becomes a function, and a bound method keeps one
    // function per instance and method. The hook answers first in Svelthon, so
    // they are read off the source rather than observed.
    test('the engine converts a callable instance and keeps a bound method one function', () => {
        const source = String($B.pyobj2jsobj);

        expect(source).toContain('_b_.callable(pyobj)');
        expect(source).toContain('bound_methods(pyobj.im_self)');
    });

    // The engine's conversion asks a hook first, `pyobj2jsobj-hook`, and
    // Svelthon sets it so a Python callable crosses as `pyHandler` publishes it.
    test('a Python callable handed to JavaScript asks the conversion hook', () => {
        expect(String($B.pyobj2jsobj)).toContain('$B.pyobj2jsobj_hook');
        expect(typeof $B.pyobj2jsobj_hook).toBe('function');
    });

    // `pyobj2jsobj-graph`: one memo per call, registered before the children
    // are walked, and handed to the hook, which is what makes `same(rows, rows)`
    // one array through a namespace. The hook answers lists and dicts first in
    // Svelthon, so the engine's own walk is read off the source.
    test('a call converts its arguments with one memo, which the hook is given', () => {
        const source = String($B.pyobj2jsobj);

        expect(source).toContain('$B.pyobj2jsobj_hook(pyobj,memo)');
        expect(source).toContain('memo.set(pyobj,jsobj)');
        expect(String($B.JSClass.tp_getattro)).toContain('pyobj2jsobj(arg,memo)');
    });

    // `js-method-receiver-cache`: the Python function made for a method is
    // kept beside the receiver rather than on it, so a frozen object's method
    // read twice is one function, and `off(box.run)` finds `on(box.run)`.
    // `callable-type-slot`: `callable()` asks the slot `$B.$call` uses, on the
    // type. It asked `hasattr`, so an object whose `__getattr__` answers every
    // name was callable, and crossed to JavaScript as a function.
    test('callable() asks the type', () => {
        const source = String($B.builtins.callable);

        expect(source).toContain('.tp_call');
        expect(source).not.toContain('hasattr');
    });

    test('a method of a frozen object is one function across reads', () => {
        const frozen = Object.freeze({ run() {} });

        expect($B.jsobj2pyobj(frozen.run, frozen)).toBe($B.jsobj2pyobj(frozen.run, frozen));
    });

    // The counter the code generator numbers functions with starts at random
    // and is private upstream; `$B.id_counter(n)` sets it and gives back the
    // value it replaces, which is what makes one source compile to one text.
    test('the id counter can be set, and gives back what it held', () => {
        const was = $B.id_counter(1000);

        try {
            expect($B.id_counter(2000)).toBe(1000);
            expect($B.id_counter()).toBe(2000);
        } finally {
            $B.id_counter(was);
        }
    });

    // A NaN equals nothing, so `is` holds only for the same object, and a
    // container comparing members by identity-or-equality finds two NaNs
    // different: `(nan,) == (float("nan"),)` is False in CPython.
    test('two NaN objects are not one', () => {
        const one = $B.builtins.float.$factory('nan');
        const other = $B.builtins.float.$factory('nan');

        expect($B.$is(one, one)).toBe(true);
        expect($B.$is(one, other)).toBe(false);
        expect($B.is_or_equals(one, other)).toBe(false);
    });

    // A global deleted anywhere in the module is read through the lookup that
    // raises NameError, whether its reader is written before or after the
    // function that deletes it.
    test('a deleted global raises NameError in a function written before the del', () => {
        expect(deleteOrder.read_count()).toBe('3');
        deleteOrder.drop_count();
        expect(deleteOrder.read_count()).toBe('missing');
        deleteOrder.restore_count();
        expect(deleteOrder.read_count()).toBe('5');
    });

    test('and when the global is bound in a block of the module', () => {
        expect(deleteOrder.read_level()).toBe('1');
        deleteOrder.drop_level();
        expect(deleteOrder.read_level()).toBe('missing');
    });

    // A key that is a subclass of str names a keyword argument by its value,
    // and stays itself in **kwargs and in dict().
    test('a str subclass is a keyword name', () => {
        expect(strKeywords.by_subclass()).toBe('Café');
        expect(Array.from(strKeywords.kept_types())).toEqual(['Name', 'Name']);
    });

    // `javascript.JSON.parse` reads a subclass of str by its value, not by the
    // object Brython keeps it in, and `from_json` is that parse.
    test('a str subclass holding JSON is parsed', () => {
        expect(Array.from(jsonText.engine())).toEqual([42, 42]);
        expect(Array.from(jsonText.helper())).toEqual([42, 42]);
    });

    // `index` and `remove` find an item by identity before equality, as `in`
    // and `count` do: `x = float("nan"); [x].index(x)` is 0.
    test('index and remove find the very object, even a NaN', () => {
        const x = $B.builtins.float.$factory('nan');
        const method = (self, name) => $B.$getattr(self, name);
        const items = $B.$list([x]);

        expect(method(items, 'index')(x)).toBe(0);
        expect(method($B.fast_tuple([x]), 'index')(x)).toBe(0);
        method(items, 'remove')(x);
        expect(items.length).toBe(0);
    });

    // A call's keyword arguments travel under a symbol, `$B.KW`, and not under
    // a `$kw` key: a JavaScript object with that key is an argument like any
    // other. `dict(obj)` read it as keywords and answered `{'0': 'a'}`.
    test('a JavaScript object with a $kw key is data', () => {
        expect(typeof $B.KW).toBe('symbol');

        const made = $B.$call($B.builtins.dict, { $kw: ['a'] });

        expect($B.pyobj2jsobj(made)).toEqual({ $kw: ['a'] });
    });

    // A coroutine is reported as never awaited when it is reclaimed without
    // having started, as CPython reports it: `{#await later()}` hands one to
    // Svelte, which awaits it, and nothing is said; one created and thrown away
    // is told once the garbage collector takes it, which the test forces.
    test('a coroutine handed on is not reported as never awaited', async () => {
        const said = [];
        const spies = ['error', 'warn', 'log'].map((level) =>
            vi.spyOn(console, level).mockImplementation((...args) => said.push(args.join(' ')))
        );

        try {
            const target = document.body.appendChild(document.createElement('div'));
            mount(CoroutineAwaited, { target });

            await settled(() => expect(target.querySelector('[data-k="shown"]')?.textContent).toBe('done'));
            await new Promise((resolve) => setTimeout(resolve));

            expect(said.filter((one) => one.includes('never awaited'))).toEqual([]);

            target.querySelector('[data-k="drop"]').click();
            flushSync();
            await new Promise((resolve) => setTimeout(resolve));

            v8.setFlagsFromString('--expose-gc');
            const gc = runInNewContext('gc');

            await settled(() => {
                gc();
                expect(said.some((one) => one.includes("coroutine 'later' was never awaited"))).toBe(true);
            });
        } finally {
            for (const spy of spies) spy.mockRestore();
        }
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

// Converting a JavaScript object for Python asks whether it is a promise. The
// descriptor of `then` answers without running a getter of that name.
test('a then getter is not run when an object crosses into Python', () => {
    let reads = 0;
    const value = Object.defineProperty({}, 'then', { enumerable: true, get: () => ++reads });

    globalThis.__BRYTHON__.jsobj2pyobj(value);

    expect(reads).toBe(0);
});

// An int has no negative zero: one rounded, truncated, floored or ceiled from a
// negative fraction, and zero negated, are the int 0.
test('an int made from a negative fraction, or by negating zero, is not a negative zero', () => {
    const _b_ = globalThis.__BRYTHON__.builtins;
    const float = (value) => _b_.float.$factory(value);
    const made = [
        _b_.round(float(-0.5)),
        _b_.int.$factory(float(-0.5)),
        _b_.float.tp_funcs.__floor__(float(-0)),
        _b_.float.tp_funcs.__ceil__(float(-0.4)),
        _b_.int.nb_negative(0)
    ];

    for (const one of made) expect(Object.is(one, 0)).toBe(true);
});

// A module global deleted at run time, through globals(), is unbound when it is
// read: NameError, or the builtin it shadowed.
test('a global deleted through globals() reads as unbound', () => {
    expect(deletedGlobal.drop()).toBe('missing|2');
});

// A t-string field ending with a name, `t"Hello {name}"`, compiles: its closing
// brace carries the expression text the parser reads. And an Interpolation's
// attributes are readable from Python.
test('a t-string compiles, and its interpolations are read', () => {
    expect(templateStrings.described()).toBe('Hello |Ada|name|None');
});

// The rest of PEP 750, one row per commit, each the answer CPython 3.14 gives.
test.for([
    ['tstring-format-spec', 'formatted', '.2f'],
    ['tstring-trailing-string', 'ended', ['Hello ', '']],
    ['tstring-expression-text', 'expressed', '1 + 2'],
    ['tstring-template-repr', 'shown', "Template(strings=('a',), interpolations=())"],
    ['tstring-template-concat', 'joined', ['a', 'b']],
    [
        'tstring-type-names and dotted-type-name',
        'typed',
        "<class 'string.templatelib.Template'>|<class 'string.templatelib.Interpolation'>|Template"
    ],
    ['tstring-interpolation-defaults', 'defaulted', "Interpolation(1, 'x', None, '')"],
    ['tstring-match-args', 'matched', ['Ada', 'name', 'r', '^9']],
    ['tstring-template-new', 'made', ['a', 'bc']],
    ['tstring-template-iter', 'iterated', ['a', 1, 'a', 'b']]
])('t-strings as CPython has them: %s', ([, read, expected]) => {
    expect(templateStrings[read]()).toEqual(expected);
});

// `help` is the builtin function, not the string `'type help()'` that replaced
// it, so `help(obj)` prints the docstring rather than raising.
test('help is callable', () => {
    const _b_ = globalThis.__BRYTHON__.builtins;

    expect(_b_.callable(_b_.help)).toBe(true);
});

// Four syntax errors Brython failed to raise, failing in its own code instead:
// a message dropped, a location read off the wrong fields, a helper called
// under a name that no longer exists, and a recursion past the stack. Each is
// the error CPython 3.14 raises for the same source.
test.for([
    ['fstring-conversion-message', 'x = 1\ny = f"{x!z}"\n', "f-string: invalid conversion character 'z': expected 's', 'r', or 'a'"],
    ['bytes-str-concat-message', 'x = b"a" "b"\n', 'cannot mix bytes and nonbytes literals'],
    ['future-import-errors', 'from __future__ import braces\n', 'not a chance'],
    ['future-import-errors', 'from __future__ import nothing_here\n', 'future feature nothing_here is not defined'],
    ['too-many-nested-parentheses', `x = ${'('.repeat(201)}1${')'.repeat(201)}\n`, 'too many nested parentheses']
])('syntax errors as CPython raises them: %s', ([, source, message]) => {
    const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

    expect(() => compile(source, 'Probe', 'probe.py', { plain: true })).toThrow(`SyntaxError: ${message}`);
});

// The label of a debug field, `{x=}`, is the field's own text: it started at the
// f-string's second character when a conversion followed, and an f-string
// inside the field left the label of its own field behind. The answers are
// CPython's.
test.for([
    ['fstring-debug-conversion-label', 'converted', ['before:row.name=ok', "before:row.name='ok'"]],
    ['fstring-debug-nested-label', 'nested', `f'{row.name=}'="row.name='ok'"`]
])('debug f-strings as CPython labels them: %s', async ([, read, expected]) => {
    const labels = await import('./fixtures/debug_labels.py');

    expect(labels[read]()).toEqual(expected);
});

// And the label's node ends where its text does, past the `=` and the spaces
// after it, a character short of the `!`, the `:` or the `}`: CPython's
// positions for `f"{x = !s}"`, which the template reads the label by.
test('debug f-strings as CPython places them: fstring-debug-label-end', () => {
    createRequire(import.meta.url)('../src/lib/compile.cjs');
    const $B = globalThis.__BRYTHON__;
    const tree = $B._PyPegen.run_parser(new $B.Parser('f"{x = !s}"\n', '<guard>', 'file'));
    const [label] = tree.body[0].value.values[0].values;

    expect([label.col_offset, label.end_col_offset]).toEqual([3, 7]);
});

// Imported here and not at the top: the module does not compile without the
// repair, and that has to fail this test alone.
test('t-strings as CPython has them: tstring-nested-in-fstring', async () => {
    const { nested } = await import('./fixtures/template_nested.py');

    expect(nested()).toBe("<Template(strings=('a',), interpolations=())>");
});

// A list, set or dict comprehension binds its names in a scope of its own:
// never in the module's namespace, where a name's accessor took the write; kept
// by a function made in it; and a class body's names are not its own. `python3`
// on the same module.
test('a comprehension has a scope of its own: comprehension-own-scope', async () => {
    const { module_level, late, class_level } = await import('./fixtures/comprehension_scope.py');

    expect([module_level(), late(), class_level()]).toEqual([
        ['absent', 'absent'],
        [2, 2, 2],
        "name 'factor' is not defined"
    ]);
});

// A comprehension holding an `await` was an async function nobody awaited: it
// handed back a Promise where a list was written, and an `await` in one written
// in a block of the function did not compile once the comprehension had a
// scope of its own. `python3` on the same module: `([0, 2, 4], {0: 0, 1: 2})`
// and `2`.
test('a comprehension holding an await is awaited: comprehension-await', async () => {
    const { doubled, in_block } = await import('./fixtures/comprehension_await.py');

    expect([await doubled(), await in_block()]).toEqual([[[0, 2, 4], { 0: 0, 1: 2 }], 2]);
});

// And in `on_mount`, where a page awaits its data.
test('and in on_mount', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ComprehensionAwait, { target });

    await settled(() => expect(target.textContent.trim()).toBe('[0, 2, 4]'));
    target.remove();
});

// A JavaScript symbol hashed by a property set on it, which a symbol cannot
// hold: as a key of a dict or a member of a set it raised an error of the
// engine's. `python3`, two distinct objects in their place: `[2, True, 2]`.
test('a JavaScript symbol is a key like any other: symbol-hash', async () => {
    const { keyed } = await import('./fixtures/symbol_keys.py');
    const token = Symbol('token');

    expect(keyed(token, Symbol('token'))).toEqual([2, true, 2]);
});

// `ob_type` is the field Brython reads an object's class from, and a name any
// Python code may write. A dict keeps its own class under a symbol and its
// string keys as properties, so a global, a key or an attribute of that name
// was taken for the dict's class: `globals()` raised a JavaScript error, a
// class under the key broke the dict, and `locals()` left the name out. A
// method's frame held its class under the same name, for `super()`, which now
// reads it from `__class__`: `locals()`, `vars()` and `"x" in locals()` in a
// method are the method's names. `python3` on the same module.
test('a name or key spelled ob_type is the author’s: ob-type-name', async () => {
    const { spelled, method } = await import('./fixtures/ob_type_names.py');

    expect(spelled()).toEqual([5, 42, 'dict', 1, ['ob_type'], 3, 'dict', ['ob_type'], [2, 'dict']]);
    expect(method()).toEqual([['self', 'x'], true, ['self', 'x'], 'base']);
});

// A row too short for a starred target says how many values it needs: the
// names beside the star, wherever it stands. `python3` on the same two rows.
test('a starred target says the values it needs as CPython does: starred-unpack-expected-count', async () => {
    const { around, leading } = await import('./fixtures/starred_unpack.py');

    expect([around([1]), leading([1])]).toEqual([
        'not enough values to unpack (expected at least 2, got 1)',
        'not enough values to unpack (expected at least 2, got 1)'
    ]);
});

// A builtin method that takes no arguments counted its instance among them,
// took one in silence, or spoke in another method's name. `python3` on the
// same calls.
test('a method that takes no arguments refuses one in its type’s name: noargs-method-arity', async () => {
    const { refused } = await import('./fixtures/noargs_methods.py');

    expect(refused()).toEqual([
        'list.clear() takes no arguments (1 given)',
        'int.bit_length() takes no arguments (1 given)',
        'str.casefold() takes no arguments (1 given)',
        'dict.keys() takes no keyword arguments'
    ]);
});

// `list.sort` takes keyword arguments only: a positional one counted the
// instance in the message, and its text signature, which says so, was
// `undefined`. `python3` on the same module.
test('list.sort refuses a position and says it takes keywords only: list-sort-keyword-only', async () => {
    const { sort_facts } = await import('./fixtures/sort_keywords.py');

    expect(sort_facts()).toEqual([
        'sort() takes no positional arguments',
        '($self, /, *, key=None, reverse=False)',
        '($self, /, *, key=None, reverse=False)'
    ]);
});

// A generator function marked the frame of its caller as holding a generator,
// and called by JavaScript while no Python frame runs there was none:
// `TypeError: Cannot read properties of null (reading 'frame')`.
test('a generator function called from JavaScript runs: generator-called-from-javascript', async () => {
    const { numbers, later } = await import('./fixtures/generator_from_js.py');
    const $B = globalThis.__BRYTHON__;

    expect($B.frame_obj).toBeNull();
    expect([...$B.make_js_iterator($B.$call($B.PYOBJ_MAP.get(numbers) ?? numbers), $B.NULL)]).toEqual([1, 2]);
    expect($B.class_name($B.$call($B.PYOBJ_MAP.get(later) ?? later))).toBe('async_generator');
});

// An `__iter__` that returns a list, iterable and no iterator, was said to have
// returned a "non-iterable". `python3` on the same class.
test('iter() names what it refused a non-iterator: iter-non-iterator-message', async () => {
    const { walked } = await import('./fixtures/iterated_sets.py');

    expect(walked('plain')).toBe("TypeError: iter() returned non-iterator of type 'list'");
});

// An unhashable value was named by its value, `unhashable type: '[1]'`, and a
// set or a dict did not say what it was refused as, except when looked up in a
// set, where an error other than a TypeError was dressed up too.
// `python3` on the same module, its name aside.
test('an unhashable value is refused in its type’s name: unhashable-type-name, unhashable-element-context', async () => {
    const { refusals } = await import('./fixtures/unhashable_messages.py');
    const [name, ...lines] = refusals();

    expect(lines).toEqual([
        "TypeError: unhashable type: 'list'",
        "TypeError: cannot use 'list' as a set element (unhashable type: 'list')",
        "TypeError: cannot use 'list' as a set element (unhashable type: 'list')",
        "TypeError: cannot use 'list' as a set element (unhashable type: 'list')",
        "TypeError: cannot use 'list' as a dict key (unhashable type: 'list')",
        "TypeError: cannot use 'list' as a dict key (unhashable type: 'list')",
        `TypeError: cannot use '${name}.Outer.Refuses' as a set element (mine)`,
        'ValueError: mine'
    ]);
});

// The set operations read any array's storage and any dict's, so a JavaScript
// array's floats went in unconverted, `0.5 in set(values)` was False, a list
// or a dict subclass's `__iter__` was not asked, and `issubset` of a dict
// raised from inside the engine.
test('a set made from what is not a list, a tuple or a dict iterates it: set-update-iterates', async () => {
    const { made } = await import('./fixtures/set_from_js.py');

    expect(made([0.5, 1.5])).toEqual([true, true, true, [9], [1], [1], true]);
});

// A builtin that takes no arguments said "takes no argument", and `locals()`
// refused a keyword with the same sentence. `python3` on the same module, at
// its top and in a function.
test('a builtin taking no arguments refuses one as CPython words it: no-arguments-message, locals-no-keyword-arguments', async () => {
    const { top, inside } = await import('./fixtures/no_arguments.py');
    const locals = ['locals() takes no arguments (1 given)', 'locals() takes no keyword arguments'];

    expect(top).toEqual(locals);
    expect(inside()).toEqual(['globals() takes no arguments (1 given)', 'globals() takes no keyword arguments', ...locals]);
});

// A builtin that takes one argument said "takes exactly 1 argument", one that
// takes several "takes exactly 2 arguments", and a method counted its
// instance: `set().add()` said "takes exactly 2 arguments (1 given)".
test('a wrong number of arguments is told in the count the caller wrote: nb-args-messages', async () => {
    const { refusals } = await import('./fixtures/arity_messages.py');

    expect(refusals()).toEqual([
        'abs() takes exactly one argument (0 given)',
        'len() takes exactly one argument (2 given)',
        'divmod expected 2 arguments, got 1',
        'isinstance expected 2 arguments, got 3',
        'set.add() takes exactly one argument (0 given)',
        'list.append() takes exactly one argument (2 given)',
        'str.join() takes exactly one argument (0 given)',
        'str.join() takes exactly one argument (0 given)',
    ]);
});

// A memoryview's slice was a view of a copy, an item read from the end was
// `undefined`, a write out of the view or of -1 was "read-only memory" or
// wrote `-1` into the bytearray, and a released view read on. `python3` on the
// same module gives these lines.
test('a memoryview reads and writes its buffer as CPython does: memoryview-index-error, memoryview-released, memoryview-slice-shares', async () => {
    const { answers } = await import('./fixtures/memoryview_contract.py');

    expect([...answers()]).toEqual([
        "([120, 122], b'axz', True)",
        '99',
        'IndexError: index out of bounds on dimension 1',
        "ValueError: memoryview: invalid value for format 'B'",
        'ValueError: operation forbidden on released memoryview object'
    ]);
});

// A builtin held as a class's `__call__` was handed the instance, a receiver it
// did not take or already had, `list.clear() takes no arguments (1 given)`; and
// `conjugate()` of an int answered nothing, of a float raised. `python3` on the
// same module gives these lines.
test('a builtin as __call__ is called as it is, and a number has its conjugate: call-builtin-unbound, int-conjugate, float-conjugate', async () => {
    const { answers } = await import('./fixtures/builtin_call.py');

    expect([...answers()]).toEqual(['(None, [])', '2', "{'a': None}", "'ABC'", '(3, 1, 0.25)']);
});

// An identifier is normalized to NFKC, as Python reads one: `box.ﬁeld` raised
// `AttributeError` where it reads `box.field`, and so did an accent written in
// two code points. A string is not normalized.
test('an identifier is read in its normalized form: identifier-nfkc', async () => {
    const { answers } = await import('./fixtures/nfkc_names.py');

    expect([...answers()]).toEqual(['field', 'flag', '8', 'full', 'composed', 'missing']);
});

// A metaclass's `__getattribute__` was handed a third argument, so every read of
// a class it governs raised `TypeError`, `Plain.__name__` included, and the
// AttributeError it raises is its own message. And a subscript asked the
// metaclass for `__setitem__`, `__delitem__` and, for a slice, `__getitem__`,
// where Python reads the class's MRO, which the metaclass's own `__getitem__`
// is the first of when the subscript is on a class (merged #2996).
test('a metaclass __getattribute__ is called with the class and the name, and a subscript never asks it: metaclass-getattribute-args, item-dunder-mro-lookup, #2996', async () => {
    const { answers } = await import('./fixtures/metaclass_getattribute.py');

    expect([...answers()]).toEqual([
        '1',
        'Plain',
        '0',
        'False',
        'fallback',
        'slice(0, 1, None)',
        "{'k': 1}",
        '{}',
        'custom message',
        "('meta get', 1)",
        "('meta get', slice(0, 1, None))"
    ]);
});

// A method descriptor called through its type checks its receiver: `list.append`
// handed an object that is not a list answered `None`, and `str.upper` handed
// an int raised a `JavascriptError`.
test('a method descriptor refuses a receiver of another type: method-descriptor-receiver', async () => {
    const { answers } = await import('./fixtures/method_receiver.py');

    expect([...answers()]).toEqual([
        "descriptor 'append' for 'list' objects doesn't apply to a 'K' object",
        "descriptor 'get' for 'dict' objects doesn't apply to a 'K' object",
        "descriptor 'upper' for 'str' objects doesn't apply to a 'int' object",
        '[5]'
    ]);
});

// The `__dict__` attribute as Python reads it. An instance whose class keeps it
// out of its `__slots__` answered a JavaScript `undefined`; `vars()` read the
// engine's dictionary rather than the attribute, so a class handed out a
// mutable dict where Python hands its mappingproxy; and `super(C, C)` bound
// what it found to the class, running a property's getter on it. An
// `__init_subclass__` written in a class body is a classmethod, which the class
// statement's own `super(C, C)` call finds bound.
test('the __dict__ attribute is read as Python reads it: init-subclass-classmethod, super-type-no-instance, slots-no-dict-descriptor, vars-dict-attribute', async () => {
    const { answers } = await import('./fixtures/dict_attribute.py');

    expect([...answers()]).toEqual([
        "'Slotted' object has no attribute '__dict__'",
        'False',
        'mappingproxy',
        'property',
        'function',
        'getset_descriptor',
        'value',
        'classmethod',
        "['Entry']"
    ]);
});

// A method-wrapper compares and hashes by its function and its receiver: both
// slots were empty functions, so `box.__setattr__ == box.__setattr__` answered
// a JavaScript `undefined` (merged #2989, after the vendored master).
test('a method-wrapper is equal to itself and hashes alike: #2989', async () => {
    const { answers } = await import('./fixtures/method_wrapper_eq.py');

    expect([...answers()]).toEqual(['True', 'False', 'True', 'False', 'True']);
});

// A class given new bases reorders its subclasses too: only the class itself
// was, so `D(C)` kept looking a name up on `C`'s old base.
test('new bases reorder the subclasses: bases-set-subclass-mro', async () => {
    const { answers } = await import('./fixtures/bases_assignment.py');

    expect([...answers()]).toEqual(['1', 'F,D,E,C,B,object']);
});

// The registry `__subclasses__()` reads: a class with no base written is under
// `object` (merged #2982, after the vendored master), and a class given new
// bases moves from the old ones to the new, unless the assignment is refused,
// which leaves the class as it was.
test('a class is listed under the bases it has: #2982, bases-set-moves-subclass, bases-set-subclass-mro', async () => {
    const { answers } = await import('./fixtures/subclass_registry.py');

    expect([...answers()]).toEqual(['True', 'TypeError', 'X,B,object', 'True', 'False']);
});

// And it holds its classes weakly: a class a component made once per mount,
// and nobody refers to any more, is collected, where every base kept every
// subclass it ever had. Collection is out of this file's reach, so the registry
// is read as the engine keeps it: no array, weak references, and what it yields
// (`tests/class-retention.test.js` collects for real).
test('the subclasses of a class are held weakly: subclasses-held-weakly', () => {
    const $B = globalThis.__BRYTHON__;
    const registry = $B.builtins.object.tp_subclasses;

    expect(Array.isArray(registry)).toBe(false);
    expect(String($B.subclasses)).toContain('WeakRef');
    expect([...registry].length).toBeGreaterThan(0);
});

// New bases CPython refuses are refused before anything changes: an empty
// tuple, a value that is no class, a cycle, and bases whose instances are not
// laid out as the old ones were. All were taken, `(1,)` failing half way. The
// layout is read off the slots a class has, whatever their order or spelling:
// a text of the declaration refused two orders of the same slots and took two
// dicts of different ones.
test('new bases CPython refuses leave the class as it was: bases-set-validates', async () => {
    const { answers } = await import('./fixtures/bases_refused.py');

    expect([...answers()]).toEqual([
        'can only assign non-empty tuple to C.__bases__, not () | A True',
        "C.__bases__ must be tuple of classes, not 'int' | A True",
        'a __bases__ item causes an inheritance cycle | A True',
        "__bases__ assignment: 'object' deallocator differs from 'A' | A True",
        "__bases__ assignment: 'M' object layout differs from 'A' | A True",
        'accepted',
        'accepted',
        "__bases__ assignment: 'B' object layout differs from 'A'"
    ]);
});

// What a class calls and iterates follows its new bases, its subclass's too:
// both kept the old base's `__call__` and `__iter__`, and `__base__`.
test('new bases bring their special methods: bases-set-resets-slots', async () => {
    const { answers } = await import('./fixtures/bases_protocols.py');

    expect([...answers()]).toEqual(['B', 'B', 'B', 'B', 'B']);
});

// A base written twice is named, builtins laid out apart cannot be bases of
// one class, the one laid out apart being the class's `__base__`, and bases
// with no consistent MRO are named. And a slot is an identifier, a `__dict__`
// declared once, a name the class does not bind: `type()` took any name, and
// raised a JavaScript error on a slot that is no string.
test('a class refuses the bases and slots CPython refuses, and keeps a redeclared slot apart: mro-duplicate-base, solid-base-builtin-layout, mro-error-message, slots-class-variable-conflict, slots-variable-size-base, slots-shadowed-storage, slots-valid-identifiers', async () => {
    const { answers } = await import('./fixtures/class_bases.py');

    expect([...answers()]).toEqual([
        'duplicate base class A',
        'multiple bases have instance lay-out conflict',
        'list',
        'Cannot create a consistent method resolution order (MRO) for bases A, E',
        "'x' in __slots__ conflicts with class variable",
        "nonempty __slots__ not supported for subtype of 'tuple'",
        '2 1',
        '__slots__ must be identifiers',
        "__slots__ items must be strings, not 'int'",
        '__dict__ slot disallowed: we already got one',
        'P'
    ]);
});

// What `compile()` hands to `exec()` runs where its tree leaves a field out:
// the field came back as None rather than empty, and a method, a bare
// `return`, a slice, a `**` or a `with` with no `as` raised a JavaScript error.
// A page's runtime has no parser, so this runs in the engine the compiler
// loads; `python3` on the same lines prints the answers.
test('code from compile() runs where its tree leaves a field out: compile-ast-optional-none', () => {
    createRequire(import.meta.url)('../src/lib/compile.cjs');
    const $B = globalThis.__BRYTHON__;
    const program = [
        'SOURCES = [',
        '    "class A:\\n    def f(self):\\n        return 1\\nout = A().f()",',
        '    "def f():\\n    return\\nout = f()",',
        '    "a = [0, 1, 2, 3]\\nout = (a[1:], a[::2])",',
        '    "def f(**k):\\n    return k\\nout = f(**{\'a\': 1})",',
        '    "class C:\\n    def __enter__(self): return 1\\n    def __exit__(self, *a): return False\\nwith C():\\n    out = \'in\'",',
        ']',
        'seen = []',
        'for source in SOURCES:',
        '    space = {}',
        '    exec(compile(source, "<string>", "exec"), space)',
        '    seen.append(repr(space["out"]))',
        ''
    ].join('\n');
    const js = $B.py2js({ src: program, filename: 'round_trip.py' }, 'round_trip', ['round_trip']).to_js();
    const { seen } = new Function(`${js}\nreturn locals_round_trip_py;`)();

    expect([...seen]).toEqual(['1', 'None', '([1, 2, 3], [0, 2])', "{'a': 1}", "'in'"]);
});

// And the runtime reads the slot `box.x` reads, the subclass's, through the
// descriptors: it read the storage by its name, which is the base's.
test('a redeclared slot crosses as box.x reads it: slots-shadowed-storage', async () => {
    const { shadowed_box } = await import('./fixtures/class_bases.py');
    const { plainData } = await import('../src/lib/runtime.js');

    expect(plainData(shadowed_box())).toEqual({ x: 2 });
});

// A loop wrote its position on the value it walked, which a str refuses in a
// module; a str subclass iterated over a property it does not have; str() and
// repr() reshaped combining and astral characters and a stepped slice cut them
// in two; a descriptor's `__set__` returned undefined; `__slots__` iterated a
// str subclass and replaced a str by an array; a slot written once its
// descriptor was gone read a property that does not exist.
test('text, descriptors and slots answer as in CPython: for-loop-inum, str-subclass-iteration, str-keeps-its-characters, str-slice-step-astral, descriptor-set-returns-none, slots-str-subclass, slots-valid-identifiers, slot-deleted-descriptor', async () => {
    const { answers } = await import('./fixtures/text_and_slots.py');

    expect([...answers()]).toEqual([
        '[]',
        "['a', 'b']",
        "['😀', 'a']",
        "['a', 'b']",
        'True',
        '5',
        'True',
        "'😀😀'",
        "'b😀a😀'",
        "[[(None, None), (None, None)], '__delete__']",
        "[True, False, True, 'field', 'refused']"
    ]);
});

// A str method read a str subclass as a JavaScript object, as receiver or
// argument; positions and lengths around an astral character counted UTF-16
// units; center() put the odd fill char right; float() refused a str subclass;
// print() of astral text was refused by the console's write(); a class wrapped
// a staticmethod __class_getitem__, handed it its key in a tuple, replaced a
// __dict__ of its own, skipped __set_name__ for some names, and rewrote its
// methods' __qualname__.
test('str methods and class creation answer as in CPython: str-subclass-arguments, str-astral-positions, str-astral-results, str-center-margin, float-str-subclass, write-str-check, class-getitem-raw-key, classmethod-hook-function, class-dict-kept, set-name-every-key, method-qualname-kept', async () => {
    const { answers } = await import('./fixtures/strings_and_class_hooks.py');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
        expect([...answers()]).toEqual([
            "['a-b', 'ab b ', True, 2, b'ab']",
            "[('😀a', '|', 'b'), ['😀a', 'b'], '  😀a', True]",
            '[2, 2, 2, 4, 4]',
            "['**ab*', '*😀*']",
            '1.5',
            "'printed'",
            "[3, 3, (<class 'int'>,)]",
            "[{'public': 1}, ['__doc__', 'x'], ('local_method.<locals>.Box.f', 'free')]"
        ]);
        expect(log).toHaveBeenCalledWith('😀a\n');
    } finally {
        log.mockRestore();
    }
});

// A bytes iterator started over when asked for its iterator; a bytearray
// iterator read the size its bytearray had when it started; translate() took
// any error of its table for a missing key and dropped what it could not use;
// maketrans() read an astral character as two.
test('bytes iterators, translate() and maketrans() answer as in CPython: bytes-iterator-keeps-position, bytearray-iterator-live-length, str-translate-errors, str-maketrans-astral, iterator-length-hint, iterator-setstate', async () => {
    const { answers } = await import('./fixtures/bytes_iteration_and_translate.py');

    expect([...answers()]).toEqual([
        '[98, 99, 100]',
        '([98, 99, 100, 101], [])',
        'RuntimeError',
        'ValueError',
        "'😀\\x01'",
        "'xb'",
        "{128512: 'x'}",
        '[2, 2, 2, 2, 2]',
        "[[3, 4], [3, 4], ['😀', 'd'], [99, 100], [5, 7], [9007199254740993]]"
    ]);
});

// A __getitem__ iterator started over when asked for its iterator and read
// its sequence again once exhausted; __getitem__ was called unbound, whatever
// its descriptor; enumerate counted from its start with JavaScript arithmetic;
// a subclass of filter made filters; zip() made an iterator it could not run;
// a str or bytes search looked beyond its bounds.
test('sequences, iterators and searches answer as in CPython: sequence-iterator-position, getitem-binding, enumerate-start, builtin-iterator-subclass, zip-no-argument, str-search-bounds, bytes-search-bounds', async () => {
    const { answers } = await import('./fixtures/sequences_and_searches.py');

    expect([...answers()]).toEqual([
        "([2, 3], 'stop')",
        '(2, [1, 2])',
        '1',
        "[(7, 'a'), (8, 'b')]",
        "[(9007199254740993, 'a'), (9007199254740994, 'b')]",
        'TypeError',
        "('Labelled', 'derived', True, [1, 2])",
        '[]',
        '(-1, -1, 1, False, False, 4, 1)',
        '(1, 4, -1, False, 1)'
    ]);
});

// hasattr() answered False for any error; a dict subclass copied as empty and
// updated a dict through its storage whatever it redefined; round() missed a
// subclass's __round__ and rounded in JavaScript arithmetic; isinstance()
// ignored a proxy's __class__ and took a list; an iterator took any index as
// its state; __slots__ could ask again for a __dict__ a base gives.
test('attributes, dicts and rounding answer as in CPython: hasattr-attribute-error, dict-subclass-copy, dict-update-arg, round-exact, isinstance-reported-class, isinstance-list-refused, iterator-setstate, slots-marker-redeclared', async () => {
    const { answers } = await import('./fixtures/attributes_dicts_rounding.py');

    expect([...answers()]).toEqual([
        'RuntimeError',
        "{'a': 1, 'b': 2}",
        "{'before': 0, 'b': 2}",
        'TypeError',
        'TypeError',
        '(1200, 9007199254740993, 2.67, 2.0)',
        "(('custom', 1), 1.2)",
        'True',
        'TypeError',
        'TypeError',
        'TypeError'
    ]);
});

// A class statement that raised left its frame on the stack, and the caller
// then read its locals in the wrong frame; __slots__ asked for a __dict__
// against every base instead of the one that sets the layout, and took the
// '__dict__' marker for a slot; a bytes search turned the error of an
// __index__ into a TypeError.
test('class frames, layouts and search bounds answer as in CPython: class-frame-left, slots-marker-redeclared, solid-base-slot-markers, bytes-search-bounds', async () => {
    const { answers } = await import('./fixtures/class_frames_and_layouts.py');

    expect([...answers()]).toEqual(["'refused'", "'B'", 'TypeError', "'B'", 'ValueError']);
});

// A dict keyed by "hasOwnProperty", an instance's attributes included, called
// that key as a method; a float key written in a dict display was filed under
// a rounded hash and never found; a str key taken out of a dict with other keys
// stayed behind as a property, which get() read; a lookup after popitem spliced
// an undeclared index and threw; and list(), max(), dict() and bytes() read the
// storage of a list subclass instead of its __iter__. dict() and bytes() read a
// JavaScript array's storage too: a pair of floats made a key no float found,
// and bytes() of a float made a byte of it.
test('dicts and list subclasses answer as in CPython: dict-has-own-property-key, attribute-has-own-property, dict-literal-big-hash, dict-str-key-removed, dict-lookup-after-popitem, list-subclass-iter, min-max-subclass-iter, dict-pair-subclass-iter, bytes-subclass-iter', async () => {
    const { answers, from_javascript } = await import('./fixtures/dicts_and_subclass_iteration.py');

    expect([...answers()]).toEqual([
        '1', "[13, {'hasOwnProperty': 13}]", '2.5', "'absent'", 'False', '[10, 20]', '20', '{10: 20}', "b'\\n\\x14'"
    ]);
    expect([...from_javascript([1.5, 2.5], [1, 2], [1.5])]).toEqual(["[('float', 2.5)]", "b'\\x01\\x02'", 'TypeError']);
});

// The console's write() returned None where CPython gives the number of
// characters written. A component cannot import `sys`; the runtime's stdout
// is read where Brython keeps it.
test("the console's write() returns what it wrote: write-returns-count", () => {
    const $B = globalThis.__BRYTHON__;
    const write = $B.$getattr($B.get_stdout(), 'write');

    expect($B.$call(write, 'ab')).toBe(2);
});

// A module named with a quote, from a file such as `src/Jean's app/Page.svelte`,
// had its name pasted between quotes in the code of every def, lambda, class
// and comprehension, which then stopped parsing.
test('a quote in a module name leaves its functions parseable: module-name-quote-literals', () => {
    const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');
    const body = 'def f():\n    return [x for x in (lambda: "ab")()]\n\nclass K:\n    y: int = 1\n';
    const { module } = compile(body, 'Probe', "src/Jean's app/Page.svelte");

    expect(() => new Function(module.replace(/^import .*$/gm, '').replace(/^export /gm, ''))).not.toThrow();
});
