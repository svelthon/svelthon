# Patches applied to the vendored Brython

`brython_runtime.js` and `brython_compiler.js` are cut from one bundle, built
from Brython's master of 11 September 2026 plus eighty-five proposed commits
(`metaclass-getattribute-args` in two, as amended for its PR) and four merged
upstream since (#3022, #2996, #2989, #2982), with **four** edits
made in the file itself afterwards. The wrapper, the integer format and the
`__call__` binding carry a `/* SVELTHON patch, see BRYTHON_FIX.md */` comment,
the only way to find them again in 1.4 MB; the other edit *is* a comment, so
`@vite-ignore` finds itself.

**The integer format and the `__call__` binding are edited in the built file
only**, not in `vendor-base`, so `scripts/vendor-brython.py` drops them:
re-apply them by hand after a re-vendoring. `tests/vendor.test.js` turns red
until they are.

The commits are Brython's own, proposed upstream and carried here while they
wait, which is what this project has always done rather than hold a fix back.
The one merged upstream is master's `18571ba0d` (#3022), a memoryview's item
decoded by its format and read from the end, which the slice commit below is
written against:

| branch | what it changes |
|---|---|
| `none-is-undefined` | `None` and JavaScript's `undefined` become one value seen from two sides, in both directions. `javascript.UNDEFINED` becomes `None`, `null` and `javascript.NULL` are untouched, and `js_array.tp_repr` converts its elements the way the iterator already did |
| `undefined-str-slot` | `UndefinedType` gains the `tp_str` it lacked, so `str()` of a raw JavaScript `undefined` answers instead of raising about a descriptor with no argument |
| `json-big-integers` | `javascript.JSON` reads and writes an integer past 2^53 with its exact digits, the way the `json` module already did. `stringify` no longer raises on a big integer and `parse` no longer hands back an `int` whose last digits are wrong. Both steps compose with an author's replacer or reviver, and both are skipped where the engine lacks `JSON.rawJSON` or the reviver's source text. `from_json` is this `parse` |
| `jsobj2pyobj-exponential` | a whole Javascript number above 2^53 crosses to Python as the int it is. It was built from the number's shortest decimal, which is another integer above 2^53 and exponential notation from 1e21 up, where `BigInt()` refused it outright. `to_py` reaches this on any large number coming back from JavaScript |
| `mark-compiler-chain` | two comments around the parsing chain in the generated `brython.js`, which is what `scripts/vendor-brython.py` cuts on to build `brython_runtime.js` |
| `fstring-format-spec-quote` | a quote used as the **fill character** of a format specification is escaped before being pasted into the generated literal. `f"{3:'>5}"` emitted `$B.String(''>5')`, and the generated JavaScript stopped parsing — *missing ) after argument list* — on an expression CPython prints as `''''3`. A string constant reaches the emitter escaped when it came from a source literal and raw when it came from a specification, so the escape is applied only to a quote that has an even number of backslashes before it |
| `ob-type-name` | a dict key, a module global, an attribute or a local spelled `ob_type` is the author's. A dict keeps its class under a symbol and its string keys as properties, so the key shadowed the field `get_class` reads first: `globals()` raised a JavaScript error once a module bound `ob_type`, and `d["ob_type"] = "business"` left the dictionary answering a string for its own class. `get_class` takes the symbol first when the object holds it itself, so a dict's `ob_type` is data whatever it holds, a class included. A method's frame held its class under the same field for `super()` without arguments, which now reads it from `__class__`, written beside it already, so `locals()`, `vars()` and `dir()` in a method list the method's names and `locals()` has no name to leave out. It replaces the second commit `dict-proto-key` had, which sent the key to the hash table: dicts worked, and an attribute of that name, read through the own-property path, was lost |
| `dict-proto-key` | a dict entry whose key is `"__proto__"` is kept. The fast path for a string key is `d[key] = value`, which reaches the accessor on `Object.prototype`: the entry was lost and the value became the dictionary's own prototype, so `"__proto__" in d` was false and reading it raised `KeyError` on a key that had been written. It goes to the hash table instead, exactly as a string parsed as a negative integer already did, and the four sites that ask whether a key can be an ordinary property now ask it in one place |
| `import-name-invalid-identifier-chars` | the identifier a module's wrapper is read back through is built by one rule, `$B.scope_name`, instead of one per site. The generator replaced every character an identifier cannot hold, the importer replaced the dot alone, so the two disagreed on anything else and `new Function` answered *Arg string terminates parameters early*. Five callers, one definition |
| `escape-module-literals` | the module name and the filename are written into the generated module with `JSON.stringify` rather than pasted between quotes. `src/O'Brien.py` is a legal filename, and it closed four literals in a row — the namespace, the frame, `__file__` and `__name__` — so a valid Python file compiled to JavaScript that would not parse |
| `module-name-quote-literals` | the same for the literals of every def, lambda, class, comprehension, `__annotate__` and type parameter: the frame, `$function_infos`, a class's `__module__`, the filename a comprehension's frame carries. A component under `src/Jean's app/` stopped parsing as soon as it held a `def` |
| `noargs-method-arity` | a builtin method that takes no arguments refuses any, `list.clear() takes no arguments (1 given)` and `takes no keyword arguments`, in the name of the type that defines it. Each type lists its methods in `noargs_methods`, beside `tp_methods`, as CPython flags them `METH_NOARGS`, and `finalize_type` puts the check in the function the descriptor calls, once. Sixty-two said `clear() takes 1 positional argument but 2 were given`, counting the instance; forty-four took the argument in silence, `(5).bit_length(1)` among them; `str.casefold` spoke as `set.remove`. The checks the bodies made are gone, so `dict.keys()` and `list.copy()` run twice as fast. It reads the keywords under `$B.KW`, so it depends on `kw-bundle-symbol` |
| `list-sort-keyword-only` | `list.sort` takes keyword arguments only: a positional one raises `sort() takes no positional arguments`, where the message counted the instance, `sort() takes 1 positional argument but 2 were given`. `list.sort.__text_signature__` is `($self, /, *, key=None, reverse=False)`, and a bound method carries its descriptor's; the getters answered `undefined`, and now answer `None` where no signature is known |
| `generator-called-from-javascript` | a generator function marks the frame of its caller as holding a generator only when there is one. Called by JavaScript while no Python frame ran, a generator or an async generator function raised `TypeError: Cannot read properties of null (reading 'frame')` before its first line: a list or set subclass whose `__iter__` yields, walked by JavaScript, among them |
| `iter-non-iterator-message` | an `__iter__` that returns something with no `__next__` raises `iter() returned non-iterator of type 'list'`, where it said `non-iterable` of a list, which is iterable |
| `unhashable-type-name` | `hash()` of an unhashable value names its type, `unhashable type: 'list'`, where it wrote the value, `unhashable type: '[1]'` |
| `unhashable-element-context` | a set element or a dict key refused by `hash()` says what it was refused as, `cannot use 'list' as a set element (unhashable type: 'list')`, at every site that hashes one, through `$B.hash_for`, with the class named by its module and qualified name (`$B.class_full_name`). Only a set lookup said it, and it dressed up a `ValueError` of an author's `__hash__` too; `[1] in {"a": 2}` raised `descr.wrapped is not a function`. Vendored as one commit; proposed upstream as two, `unhashable-element-context` for a set (#3149) and `unhashable-dict-key-context` for a dict (#3150). The qualified name is in neither: it is proposed once both and #3123, master's `__qualname__` of a nested class, are merged |
| `set-update-iterates` | the set operations read the storage of an exact list, tuple or dict only, and iterate anything else. They read any array's storage, so a JavaScript array's floats went in unconverted, as `JSObject`s, and `0.5 in set(values)` was False; a list or dict subclass's `__iter__` was not asked, nor its refusal heard; `issubset` of a dict walked the set as a dict and raised a `JavascriptError`, and now builds a set of a non-set argument, as `issuperset` did. Vendored as one commit; proposed upstream as three, `set-update-iterates` (#3151), `set-dict-subclass-iterates` (#3153) and `issubset-builds-a-set` (#3152) |
| `no-arguments-message` | a builtin that takes no arguments refuses one with `globals() takes no arguments (1 given)`, in the plural, where it wrote `takes no argument` |
| `locals-no-keyword-arguments` | `locals(x=1)` raises `locals() takes no keyword arguments`, as `globals(x=1)` does, where it counted the keyword as an argument |
| `nb-args-messages` | `$B.check_nb_args` and `$B.check_nb_args_no_kw` word a wrong count in one place: `abs() takes exactly one argument (0 given)` for a builtin that takes one, `divmod expected 2 arguments, got 1` for one that takes several, where both said `takes exactly 2 arguments (1 given)`. A method passes `true` after `arguments`, and its instance is not counted: `set().add()` said `takes exactly 2 arguments (1 given)`, and says `set.add() takes exactly one argument (0 given)`; `[].append` is named `list.append`. On `no-arguments-message`. The `math` functions call the same checker in the branch `math-argument-messages`, not vendored: `math` is not in the bundle |
| `memoryview-index-error` | a memoryview item write checks, in CPython's order, a read-only view (`TypeError`), an index out of the view (`IndexError`, where it said "read-only memory") and a value its format cannot hold (`ValueError` and `TypeError` in CPython's words, where `-1` was written into the bytearray as is, `bytearray(b'\x-1bc')`) |
| `memoryview-released` | a released view refuses every operation and attribute with `ValueError: operation forbidden on released memoryview object`, where it read and wrote on; `release()` and `__exit__` return None, `repr` says released, and a released view is equal to itself alone. One wrapper at the end of the module, around what each operation does |
| `memoryview-slice-shares` | a slice of a view is a view of the same buffer, an offset, a stride and a length in it, where it was a view of a copy: `memoryview(source)[1:]` read old bytes after `source` changed and wrote into nothing. Reading, writing, iterating, `tobytes`, `bytes()`, `cast` of a contiguous slice and `toreadonly` read through it. Written for the merged state of `memoryview-index-error`, whose item write it extends |
| `call-builtin-unbound` | a builtin held as a class's `__call__`, `len`, `dict.fromkeys` or one bound to its own receiver like `rows.clear`, is called as it is: a builtin has no `__get__`, and only what has one is handed the instance. `$B.$call` handed it to every JavaScript function, so `class Clearer: __call__ = rows.clear` raised `list.clear() takes no arguments (1 given)` when called with none |
| `identifier-nfkc` | an identifier holding a character past ASCII is normalized to NFKC, in `name_from_token`, through a `new_identifier` that now works: `box.ﬁeld` reads `field`, `Ⅷ` is `VIII`, and an accent written in two code points names what the one written in one names, where each raised `AttributeError` or `NameError`. A string is not normalized: `getattr(box, "ﬁeld")` still misses |
| `metaclass-getattribute-args` | a metaclass's `__getattribute__` is called with the class and the name, and an `AttributeError` it raises falls back to the metaclass's `__getattr__` or to the default of `getattr()`, as the instance side does. `type_getattribute` handed it a third argument, so every read of a class it governs raised `TypeError: __getattribute__() takes 2 positional arguments but 3 were given`, `K.__name__` included |
| `item-dunder-mro-lookup` | a subscript assignment `obj[k] = v`, a deletion `del obj[k]` and a slice `obj[a:b]` find `__setitem__`, `__delitem__` and `__getitem__` along the class's MRO, as `obj[k]` already did, and never through the metaclass's `__getattribute__`: a metaclass that hid them refused the operation, and `object()[0:1]` raised `AttributeError` where it raises `TypeError: 'object' object is not subscriptable` |
| `method-descriptor-receiver` | a method descriptor called through its type checks that its receiver is an instance of the type, as the getset descriptor beside it already does: `list.append(K(), 5)` and `dict.get(K(), 1)` answered `None` where they raise `TypeError: descriptor 'append' for 'list' objects doesn't apply to a 'K' object`, and `str.upper(1)` raised a `JavascriptError` |
| `int-conjugate` | `int.conjugate()` returns the int, `True.conjugate()` included, where its body was empty and it returned nothing (#3053) |
| `float-conjugate` | `float.conjugate()` returns the float, where it raised `NotImplementedError` (#3044) |
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
| `bases-set-subclass-mro` | a class given new bases, `C.__bases__ = (B,)`, reorders its subclasses too, where only the class itself was: `D(C)` kept finding the name on `C`'s old base. An assignment a subclass's order refuses leaves every class as it was |
| `bases-set-moves-subclass` | a class given new bases leaves its old bases' `__subclasses__()` for the new ones', where it stayed under the old: a second change higher up then missed it. In `vendor-base` it uses the registry's `remove`, the merged state of `subclasses-held-weakly` |
| `subclasses-held-weakly` | a class's subclasses are held weakly, so a class nobody refers to any more is collected: every base kept every subclass it ever had, a class a component makes once per mount among them. Iterating the registry yields the live ones, so its readers are unchanged |
| `init-subclass-classmethod` | an `__init_subclass__` written in a class body is a classmethod, as `__class_getitem__` already was: `vars(C)["__init_subclass__"]` was a function, and `C.__init_subclass__` a function not bound to `C` |
| `super-type-no-instance` | a `super()` whose second argument is its own start type hands what it finds no instance: `super(C, C).prop` is the property, where its getter ran with the class as `self`, `super(C, C).method` the function, where it was bound to the class, and `super(C, C).__dict__` the descriptor. On `init-subclass-classmethod`, which the class statement's own `super()` call relied on |
| `slots-no-dict-descriptor` | a class whose `__slots__` leave out `'__dict__'` gets no `__dict__` descriptor, so its instance raises `AttributeError` for `__dict__`, where it answered a JavaScript `undefined` |
| `vars-dict-attribute` | `vars(obj)` reads the `__dict__` attribute, where it read the engine's dictionary: `vars(C)` of a class is its mappingproxy, where it was a dict anyone could write the class through, and a read of a class's names through `vars()` is a read Svelthon follows. On `slots-no-dict-descriptor`, without which `vars()` of a slotted instance answered `undefined` |

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
| `$B.$call`: a `__call__` that is not a function goes through its `__get__` first | CPython's `slot_tp_call`, which binds before it calls. `@classmethod def __call__` gets its class, where Brython raised `object is not callable`; a `@staticmethod` one keeps its answer. Proposed upstream as `call-slot-descriptor` (#3128), and kept here as an edit rather than a commit of `vendor-base` |

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
| a JavaScript symbol is hashable, a key of a dict or a member of a set, where its hash was set as a property it cannot hold; its hash is kept in a WeakMap, so it does not keep the symbol alive (branch `symbol-hash`, two commits) | the same, `tests/unpack-by-key.test.js`, the rest of a row keeping a symbol, and `tests/callback-retention.test.js` |
| a row too short for a starred target says it needs as many values as the names beside the star, `first, *middle, last = [1]` at least 2, where it counted the names after the star twice (branch `starred-unpack-expected-count`) | the same, and `tests/rest-targets.test.js`, whose template unpacks with the engine's own routine |
| a dict key, a module global, an attribute or a local spelled `ob_type` is the author's, where `globals()` raised once a module bound the name and `locals()` left it out; `super()` reads a method's class from `__class__` (branch `ob-type-name`) | the same, a method's `locals()`, `vars()` and `super()` included; `tests/spread-entries.test.js` and `tests/crossing-numeric-keys.test.js`, a dict keyed `"ob_type"` spread and exported |
| a builtin method that takes no arguments refuses any in its type's name, `list.clear() takes no arguments (1 given)`, where it counted its instance, took the argument in silence or named another method (branch `noargs-method-arity`) | `tests/vendor.test.js` |
| `list.sort` refuses a positional argument with `sort() takes no positional arguments`, and its text signature says it takes keywords only (branch `list-sort-keyword-only`) | `tests/vendor.test.js`, and `tests/native-noargs-callbacks.test.js`, `onclick={rows.sort}` |
| a module name holding a quote leaves its defs, lambdas, classes and comprehensions parseable (branch `module-name-quote-literals`) | the same, and `tests/source-path.test.js`, four paths with a quote, a double quote or a backslash |
| a generator function called from JavaScript while no Python frame runs, an async one too, runs (branch `generator-called-from-javascript`) | `tests/vendor.test.js`, and `tests/synced-exports.test.js`, a set subclass whose `__iter__` yields, walked by JavaScript |
| an `__iter__` returning no iterator is refused as a `non-iterator` (branch `iter-non-iterator-message`) | `tests/vendor.test.js`, and `tests/synced-exports.test.js`, the same refusal reaching JavaScript |
| `globals()` and `locals()` refuse an argument as CPython words it, a keyword included (branches `no-arguments-message`, `locals-no-keyword-arguments`) | `tests/vendor.test.js`, at the top of a module and in a function |
| a builtin given a wrong number of arguments says `exactly one argument` or `expected 2 arguments, got 1`, and a method does not count its instance (branch `nb-args-messages`) | `tests/vendor.test.js`, and `tests/native-noargs-callbacks.test.js`, `list.append` handed every argument of a JavaScript callback |
| a memoryview reads an item from the end, refuses a write out of it or of a value no byte holds, refuses all once released, and a slice of it reads and writes the same buffer (master's `18571ba0d`, branches `memoryview-index-error`, `memoryview-released`, `memoryview-slice-shares`) | `tests/vendor.test.js`, and `tests/buffer-view.test.js`, a slice repainted with what `python3` reads |
| a builtin held as `__call__` is called without the instance, and a number has its `conjugate()` (branches `call-builtin-unbound`, `int-conjugate`, `float-conjugate`) | `tests/vendor.test.js`, and `tests/callable-matrix.test.js`, an instance whose `__call__` is a bound builtin crossing to JavaScript |
| an identifier is read in its NFKC form, a string is not (branch `identifier-nfkc`) | `tests/vendor.test.js`, and `tests/normalized-names.test.js`, a ligature and a decomposed accent in the markup |
| a method descriptor called through its type refuses a receiver of another type (branch `method-descriptor-receiver`) | `tests/vendor.test.js` |
| a metaclass's `__getattribute__` is called with the class and the name, and a subscript never asks it (branches `metaclass-getattribute-args`, `item-dunder-mro-lookup`) | `tests/vendor.test.js`, and `tests/dot.test.js`, a mapping whose metaclass hides `__getitem__`, written through a binding |
| a set made from a JavaScript array holds Python floats, and one made from a list subclass holds what its `__iter__` yields (branch `set-update-iterates`) | `tests/vendor.test.js`, and `tests/synced-exports.test.js`, a set's walk over floats a JavaScript caller handed in |
| an unhashable value is named by its type, and a set element or a dict key says what it was refused as (branches `unhashable-type-name`, `unhashable-element-context`, `unhashable-dict-key-context`) | `tests/vendor.test.js`, and `tests/synced-exports.test.js`, a write into a set's view refused and caught by the Python caller |
| a class is listed under the bases it has, implicit `object` included, held weakly (master's `655352e85`, #2982, branches `bases-set-moves-subclass`, `subclasses-held-weakly`) | `tests/vendor.test.js` |
| a class given new bases reorders its subclasses (branch `bases-set-subclass-mro`) | `tests/vendor.test.js`, and `tests/inherited-state.test.js`, a subclass read repainted after `C.__bases__ = (B,)` |
| a method-wrapper compares and hashes by its function and its receiver (master's `e2e990dd6`, #2989) | `tests/vendor.test.js`, and `tests/method-identity.test.js`, `box.__setattr__` read twice through the runtime's wrapper |
| the `__dict__` attribute is read as Python reads it, through `vars()`, on a slotted instance and through `super(C, C)`, and `__init_subclass__` is a classmethod (branches `init-subclass-classmethod`, `super-type-no-instance`, `slots-no-dict-descriptor`, `vars-dict-attribute`) | `tests/vendor.test.js`, and `tests/oracle-attributes.test.js`, the model and the page held against CPython |

`scripts/browser-check.sh` covers the DOM node path as well, which is where
identity across the boundary is observable.

The back-reference is read from Svelthon under **Brython's** name for it,
`$B.PYOBJ_MAP`, in `src/lib/runtime.js`. While the WeakMap was a local edit it
was called `$B.$svelthonPyobj`, and the read is written with `?.`, so the
re-vendoring would have turned it into `undefined` without a word. What caught
it is the test that names the map, not the code that uses it.
