# Patches applied to the vendored Brython

`brython_runtime.js` and `brython_compiler.js` are cut from one bundle, built
from Brython's master plus fifty-one proposed commits, with **four** edits
made in the file itself afterwards. The wrapper, the integer format and the
`__call__` binding carry a `/* SVELTHON patch, see BRYTHON_FIX.md */` comment,
the only way to find them again in 1.4 MB; the other edit *is* a comment, so
`@vite-ignore` finds itself.

**The integer format and the `__call__` binding are edited in the built file
only**, not in `vendor-base`, so `scripts/vendor-brython.py` drops them:
re-apply them by hand after a re-vendoring. `tests/vendor.test.js` turns red
until they are.

The commits are Brython's own, proposed upstream and carried here while they
wait, which is what this project has always done rather than hold a fix back:

| branch | what it changes |
|---|---|
| `none-is-undefined` | `None` and JavaScript's `undefined` become one value seen from two sides, in both directions. `javascript.UNDEFINED` becomes `None`, `null` and `javascript.NULL` are untouched, and `js_array.tp_repr` converts its elements the way the iterator already did |
| `undefined-str-slot` | `UndefinedType` gains the `tp_str` it lacked, so `str()` of a raw JavaScript `undefined` answers instead of raising about a descriptor with no argument |
| `json-big-integers` | `javascript.JSON` reads and writes an integer past 2^53 with its exact digits, the way the `json` module already did. `stringify` no longer raises on a big integer and `parse` no longer hands back an `int` whose last digits are wrong. Both steps compose with an author's replacer or reviver, and both are skipped where the engine lacks `JSON.rawJSON` or the reviver's source text. `from_json` is this `parse` |
| `jsobj2pyobj-exponential` | a whole Javascript number above 2^53 crosses to Python as the int it is. It was built from the number's shortest decimal, which is another integer above 2^53 and exponential notation from 1e21 up, where `BigInt()` refused it outright. `to_py` reaches this on any large number coming back from JavaScript |
| `mark-compiler-chain` | two comments around the parsing chain in the generated `brython.js`, which is what `scripts/vendor-brython.py` cuts on to build `brython_runtime.js` |
| `fstring-format-spec-quote` | a quote used as the **fill character** of a format specification is escaped before being pasted into the generated literal. `f"{3:'>5}"` emitted `$B.String(''>5')`, and the generated JavaScript stopped parsing — *missing ) after argument list* — on an expression CPython prints as `''''3`. A string constant reaches the emitter escaped when it came from a source literal and raw when it came from a specification, so the escape is applied only to a quote that has an even number of backslashes before it |
| `dict-proto-key` (second commit) | a dict entry whose key is `"ob_type"` is kept. The mirror of the key below: it *does* become an own property, and shadows the one the engine reads to know what the object is, so `d["ob_type"] = "business"` left the dictionary answering a string for its own class and the next assignment raised `'undefined' object does not support item assignment`. Measured on 22 candidate names; it is the only other one that collides, and it goes through the same predicate |
| `dict-proto-key` | a dict entry whose key is `"__proto__"` is kept. The fast path for a string key is `d[key] = value`, which reaches the accessor on `Object.prototype`: the entry was lost and the value became the dictionary's own prototype, so `"__proto__" in d` was false and reading it raised `KeyError` on a key that had been written. It goes to the hash table instead, exactly as a string parsed as a negative integer already did, and the four sites that ask whether a key can be an ordinary property now ask it in one place |
| `import-name-invalid-identifier-chars` | the identifier a module's wrapper is read back through is built by one rule, `$B.scope_name`, instead of one per site. The generator replaced every character an identifier cannot hold, the importer replaced the dot alone, so the two disagreed on anything else and `new Function` answered *Arg string terminates parameters early*. Five callers, one definition |
| `escape-module-literals` | the module name and the filename are written into the generated module with `JSON.stringify` rather than pasted between quotes. `src/O'Brien.py` is a legal filename, and it closed four literals in a row — the namespace, the frame, `__file__` and `__name__` — so a valid Python file compiled to JavaScript that would not parse |
| `int-format-large` | `int.__format__` converts with `nb_float` before handing a float specification to `float.__format__`. `fast_float` wraps without converting, so an int of 2^53 or more arrived as a `BigInt` and `format(2 ** 53, '.2f')` raised `JavascriptError: Cannot convert a BigInt value to a number`; an int no double holds now raises CPython's `OverflowError` |
| `remove-iter-debug-log` | the two unguarded `console.log` calls on the path where `iter()` refuses an `__iter__` that returns a non-iterator are removed. They dumped the object and its class to the console before the `TypeError`, once per refusal; the function's three other traces are behind its `test` flag |
| `coroutine-returned-is-not-dropped` | a coroutine is reported as never awaited when it is reclaimed without having started, through a `FinalizationRegistry`, and no longer when the frame that made it is left. One kept, returned to its caller or handed to `{#await}` and awaited later says nothing, as in CPython; one thrown away, or left in a local that dies, is told once the garbage collector takes it. Only the coroutines not started when the turn ends are registered |
| `reproducible-compile-ids` | `$B.id_counter(n)` sets the counter the code generator numbers functions with, private and started at random, and returns its previous value. `compile()` sets it from the file's path, with `$B.lambda_magic`, so one source compiles to one text in every build, and gives both back after |
| `str-subclass-keyword` | A `**` mapping whose key is a subclass of str was matched against the parameter names as an object: `g(**{T("text"): 1})` raised `unexpected keyword argument '[object Object]'`, a builtin and `dict()` raised `keywords must be strings`. The key names the argument by its value now, and stays itself in `**kwargs` and in `dict()` |
| `del-global-any-order` | `del` took a name out of its scope at compile time, so only the code compiled after it read the name through the lookup that raises NameError: a function written above the one doing `global count; del count` still read `count` directly and got `undefined`. The symtable now records every name a `del` targets, and a global among them is always read through the lookup, bound at the top of the module or in one of its `if`, `for` or `with` blocks |
| `identity-before-equality` | `list.index`, `tuple.index` and `list.remove` compared by equality alone, where `in` and `count` test identity first: `x = float("nan"); [x].index(x)` raised `ValueError`, and so did an object whose `__eq__` answers False. They test identity first now |
| `nan-is-identity` | `$B.$is` answered True for any two NaN floats, so a container comparing its members by identity-or-equality found two distinct NaNs equal: `(float("nan"),) == (float("nan"),)` and `float("nan") in [float("nan")]` were True where CPython says False. Only the same NaN object is itself now |
| `kw-bundle-symbol` | a call's keyword arguments travel under a symbol, `$B.KW`, and no longer under a `$kw` key. A JavaScript object passed as an argument and carrying `$kw` was taken for them: `f(obj)` raised `unexpected keyword argument '0'`, `dict(obj)` answered `{'0': 'a'}`, and `tojson(to_js({"$kw": …}))` refused its own argument. No argument can carry a symbol key |
| `pyobj2jsobj-hook` | an extension point: `pyobj2jsobj` asks `$B.pyobj2jsobj_hook` first, and a result other than `undefined` is the conversion. The engine converts the arguments of every JavaScript call it makes with `pyobj2jsobj`, a local nothing outside can replace, so an application embedding Brython had no way to convert a value itself. Svelthon sets it so a Python callable crosses as `pyHandler` publishes it, trimmed to its arity before anything is read, one identity at every crossing, and a Python list, tuple or dict as a named import's arguments cross |
| `callable-instance-to-js` | `pyobj2jsobj` converts an instance of a class defining `__call__` into a JavaScript function, as it does a function and a method. It handed the object over, so `window.call(C())` raised `f is not a function` |
| `bound-method-js-identity` | `pyobj2jsobj` keeps one JavaScript function per bound method, keyed on its instance and function. A bound method is a new object at each read, and the cache was on that object, so `same(h.run, h.run)` was false and `removeEventListener(h.run)` never removed what `addEventListener(h.run)` added |
| `js-method-receiver-cache` | the Python function made for a JavaScript method is kept in a WeakMap keyed on its receiver rather than in a property written on it. A frozen, sealed or non-extensible receiver refused the property, so every read of `box.run` made a new function and a registry could not remove what it had been given |
| `pyobj2jsobj-graph` | the arguments of one JavaScript call are converted with one memo, and a list or dict is registered in it before its items are walked. `same(rows, rows)` handed over two arrays, and `rows.append(rows)` overflowed the stack. The memo is handed to the hook as its second argument, which is how Svelthon's conversion keeps the same graph |
| `callable-type-slot` | `callable()` asks the type's `tp_call`, the slot `$B.$call` uses, instead of `hasattr(obj, "__call__")`. An object whose `__getattr__` answers every name, or one given a `__call__` attribute of its own, was callable, so a configuration object crossed to JavaScript as a function and `tojson` refused it as a call |
| `json-parse-str-subclass` | `javascript.JSON.parse` reads a subclass of str by its value. It was handed to `JSON.parse` as the object Brython keeps it in, so `JSON.parse(Text('{"answer": 42}'))` raised `"[object Object]" is not valid JSON`. `from_json` is this `parse` |

The first one reaches Svelthon at `importjs`: a value handed to a JavaScript
function, or handed back by one, crosses through `pyobj2jsobj` and
`jsobj2pyobj`. `__pybridge.bound` still does its own `None` to `undefined` at
the template boundary, measured: removing it turns seven tests red on the paired
engine, because a template expression does not cross the engine's converter.
`plainData` still writes `null`, and that is not the same question: it serves
what SvelteKit *serialises*, and JSON has `null` and no `undefined`.

It used to be ten. Eight went upstream, one branch each, and the re-vendoring of
2026-09-11 took them back as ordinary Brython:
`filename-invalid-identifier-chars`, `comprehension-leaks-target`,
`fstring-middle-position`, `remove-jsclass-getattro-debug-log`,
`pyobj-backref-weakmap`, `to-dict-array-to-list`, `expose-unindent`,
`find-start-position`.

They used to be split: three in the file, two applied as Vite served it. That
split had a hole, and it was not theoretical. The served copy is the *browser's*;
the compiler loads the same file with `require` under Node, where no Vite
transform applies, so server-side rendering ran on an unrepaired Brython. It
worked only for as long as the served copy re-executed on top, which stopped
being true the day that second execution was guarded. `/api/py` in the demo, an
endpoint that builds its own `Response`, then returned 500 with
`Key Symbol(PYOBJ) in undefined.headers`.

| Still edited in place | What it buys |
|---|---|
| the whole file wrapped in `if (!(globalThis.__BRYTHON__ && globalThis.__BRYTHON__.ast))` | a second execution in one process rebuilds `$B.ast`, and the classes the compiler holds lose the `to_js()` the code generator attached |
| `/* @vite-ignore */` on the two dynamic imports | Brython loads JS modules named from Python with `import(variable)`, which Vite cannot analyse and warns about twice on every dev-server start |
| the integer format: `preformat` in `int_funcs`, and the `=` branch of `$B.format_width` | CPython's order for an int with a base prefix. The sign comes first, `-0xf` where Brython wrote `0x-f`, and a `0` fill goes after sign and prefix, `0x0f` where Brython wrote `00xf`. Right upstream too, and not yet sent there |
| `$B.$call`: a `__call__` that is not a function goes through its `__get__` first | CPython's `slot_tp_call`, which binds before it calls. `@classmethod def __call__` gets its class, where Brython raised `object is not callable`; a `@staticmethod` one keeps its answer. Right upstream too, and not yet sent there |

Wrapping the file works because `var` keeps its module scope inside a block, so
the 1.4 MB below is untouched: two added lines, top and bottom.

**Two `@vite-ignore`, and it was eighteen.** The other sixteen sat on
`$B.$import(...)`, which is Brython's own function and not a dynamic import, so
`vite:import-analysis` never looked at them; `$B.$import(` merely contains
`import(`. Measured by removing them and counting what the dev server says:
eighteen gives none, two gives none, none gives exactly two, at `import(ref)`
and `import(refs[0])`. They cost nothing at run time and sixteen edits to
re-apply at every re-vendoring.

**Both would be wrong upstream.**

The file wrapper answers a *second execution in one process*, a build tool
requiring the same file twice, or a server rendering after the compiler has run.
A browser loads the script once per page, so the guard protects nothing there
while changing the top-level shape of the file for everyone.

`/* @vite-ignore */` is a comment addressed to **one bundler**. It means nothing
to esbuild, to Rollup on its own, or in a browser. A build tool's annotation has
no place in an engine that is not built with it.

### How they are guarded

A direct edit is lost silently when a newer Brython is vendored, and so is a
behaviour, whether we sent it upstream or not. Each is held by a **test** rather
than by a build-time check, and going upstream retires none of them:

| Behaviour | Turns red |
|---|---|
| `qualified_scope_name`, `make_comp`, the tokenizer | `tests/compiler.test.js`, `tests/fidelity.test.js` |
| the two debug prints, the `PYOBJ` back-reference, `str.find`, the integer format, the `__call__` binding, the conversion hook | `tests/vendor.test.js`, and `tests/import-members.test.js` for the hook's behaviour |
| `convert_to_python` | `tests/from-json.test.js`, where an array that stayed one fails `isinstance(x, list)` |
| the file wrapper, the two `@vite-ignore` | `tests/vendor.test.js`, the last two tests |
| the id counter, `$B.id_counter` | `tests/vendor.test.js`, and `tests/compile-determinism.test.js` if it stops holding the output |
| the keyword symbol, `$B.KW` | `tests/vendor.test.js`, and `tests/helper-keywords.test.js` for a JavaScript object with a `$kw` key |
| `jsobj2pyobj` reads `then` by its descriptor (branch `jsobj-then-getter`) | `tests/vendor.test.js`, a `then` getter not run on crossing |
| an int is never a negative zero: `round`, `int`, `__floor__`, `__ceil__` of a float and `-0` (branch `int-negative-zero`) | `tests/vendor.test.js`, five ints made at zero |
| a module global deleted through `globals()` reads as unbound, `NameError` or the builtin it shadowed (branch `global-deleted-at-run-time`) | `tests/vendor.test.js`, a global and a builtin popped |
| a t-string field ending with a name, `t"Hello {name}"`, compiles: its closing brace carries the expression text the parser reads, which it lacked on that path and only that one (branch `tstring-field-ending-in-name`) | `tests/vendor.test.js`, `template_strings.py` compiles |
| the attributes of a t-string `Interpolation`, `value`, `expression`, `conversion` and `format_spec`, are readable, as `Template`'s already were (branch `tstring-interpolation-members`) | `tests/vendor.test.js`, an interpolation read |
| the format specification of an interpolation is kept: the node factory was called without its position, so the specification was taken for it, `t"{x:.2f}"` had no interpolation and `t"{x:{w}}"` raised (branch `tstring-format-spec`) | `tests/vendor.test.js`, the rows of `t-strings as CPython has them`, one per branch |
| the `expression` of an interpolation is its source text, trailing spaces and `=` stripped from the end, where it was the name read off the value, `'undefined'` for `{1 + 2}` (branch `tstring-expression-text`, on top of `tstring-format-spec`) | the same |
| a t-string ending with an interpolation ends its `strings` with an empty one (branch `tstring-trailing-string`) | the same |
| `Template(...)` takes `Interpolation` objects, joins consecutive strings and refuses anything else (branch `tstring-template-new`, on top of `tstring-trailing-string`) | the same |
| the repr of a `Template` is CPython's, `Template(strings=(...), interpolations=(...))` (branch `tstring-template-repr`) | the same |
| two templates concatenate, the last string of one joined to the first of the other (branch `tstring-template-concat`) | the same |
| `Template` and `Interpolation` carry CPython's type flags and dotted names, so `type(t"")` names `string.templatelib` once (branch `tstring-type-names`) | the same |
| the `__name__` and `__qualname__` of a builtin type named `module.name` are `name` (branch `dotted-type-name`) | the same |
| `Interpolation(value, expression)` called from Python takes the defaults of its signature (branch `tstring-interpolation-defaults`) | the same |
| `Interpolation.__match_args__`, through a `tp_match_args` slot that finalization writes into the class (branch `tstring-match-args`) | the same |
| a template is iterated by a `TemplateIter` of its own, so `list()` works and two iterations do not share a counter (branch `tstring-template-iter`) | the same |
| a t-string nested in an f-string leaves the f-string an f-string: the kind of each open string is kept with it (branch `tstring-nested-in-fstring`) | `tests/vendor.test.js`, `template_nested.py` imported alone |
| `help` is the builtin function again, not the string `'type help()'` that replaced it in the builtins module, so `help(obj)` prints the docstring rather than raising `'str' object is not callable` (branch `help-is-callable`) | `tests/vendor.test.js`, `callable(help)` |
| an invalid f-string conversion, `f"{x!z}"`, raises its `SyntaxError` with its message, which was passed in place of the parser and read as `undefined` (branch `fstring-conversion-message`) | `tests/vendor.test.js`, syntax errors as CPython raises them |
| bytes concatenated with a string, `b"a" "b"`, raises `cannot mix bytes and nonbytes literals`: its location was read off token fields the AST nodes do not have (branch `bytes-str-concat-message`) | the same |
| `from __future__ import braces` and an unknown future feature raise their `SyntaxError`, through `$B.raise_error_known_location`, where a local function of that name no longer exists (branch `future-import-errors`) | the same |
| more than 200 nested brackets raise `too many nested parentheses` in the tokenizer, before the parser recurses past the stack (branch `too-many-nested-parentheses`) | the same |
| the label of a debug field followed by a conversion, `f"before:{x=!s}"`, starts at the field and not at the f-string's second character (branch `fstring-debug-conversion-label`) | `tests/vendor.test.js` |
| the label of a debug field holding an f-string, `f"{f'{x=}'=}"`, is the whole field: the inner f-string no longer leaves the start of its own field behind (branch `fstring-debug-nested-label`) | the same |
| the label's node ends where its text does, past the `=` and the spaces after it, as CPython places it, where it ran a character into the `!`, the `:` or the `}` (branch `fstring-debug-label-end`) | the same |
| a list, set or dict comprehension binds its names in a scope of its own, as a generator expression does: they were set in the enclosing namespace, where `globals()` saw them and a name's accessor took the write, then deleted, which left a function made in the comprehension reading `undefined` (branch `comprehension-own-scope`) | `tests/vendor.test.js`, and `tests/js-import-bindings.test.js`, a comprehension over a name JavaScript imports |
| an `await` in a comprehension written in a block of an async function belongs to that function, where the comprehension's own scope made it "outside function" (third commit of branch `comprehension-own-scope`) | `tests/vendor.test.js` |
| a comprehension holding an `await` is awaited where it is written, where it handed back a Promise (branch `comprehension-await`, on `comprehension-own-scope`) | the same, in a module and in `on_mount` |
| a JavaScript symbol is hashable, a key of a dict or a member of a set, where its hash was set as a property it cannot hold (branch `symbol-hash`) | the same, and `tests/unpack-by-key.test.js`, the rest of a row keeping a symbol |
| a row too short for a starred target says it needs as many values as the names beside the star, `first, *middle, last = [1]` at least 2, where it counted the names after the star twice (branch `starred-unpack-expected-count`) | the same, and `tests/rest-targets.test.js`, whose template unpacks with the engine's own routine |

`scripts/browser-check.sh` covers the DOM node path as well, which is where
identity across the boundary is observable.

The back-reference is read from Svelthon under **Brython's** name for it,
`$B.PYOBJ_MAP`, in `src/lib/runtime.js`. While the WeakMap was a local edit it
was called `$B.$svelthonPyobj`, and the read is written with `?.`, so the
re-vendoring would have turned it into `undefined` without a word. What caught
it is the test that names the map, not the code that uses it.
