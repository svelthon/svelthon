# What Svelthon asks of Brython

Svelthon compiles Python to JavaScript with Brython and wires the result to
Svelte's signals. Almost none of what it touches is a public API: it is the
shape of Brython's internals. This file is the contract, so that a Brython change
can be checked against it, and so that whoever reads `src/lib/` knows which
assumptions are load-bearing.

Verified against the vendored `brython.js`, `$B.version_info == [3, 14, 0]`.

What the vendored build carries on top of Brython's master is in
`vendor/BRYTHON_FIX.md`, beside the bundles it describes.

## The single point everything rests on

```js
locals_Counter = $B.namespace('Counter')
locals_Counter.count = 0
```

Brython keeps a module's state in a **namespace object**, never in lexical
bindings, since Python semantics require it, for `globals()`, `exec`, and dynamic name
resolution. Svelthon replaces that object with one whose every property is an
accessor onto a Svelte signal, and every assignment the code generator already
emits becomes a reactive write.

The substitution happens at run time, by swapping `$B.namespace` for the duration
of the module body (and only for the requested name, since an import during
initialisation creates its own namespace through the same function).

**If this shape changed, Svelthon would stop working entirely.** It is the only
assumption checked at compile time: the build fails loudly when the expected call
is absent, rather than shipping a component with no reactivity.

## Internals used

### Compiler

| | |
|---|---|
| `$B.py2js(src, module, locals_id, parent)` | returns `{ _ast, imports, to_js() }` |
| `$B.brython(options)` | boot |
| `$B.ast.*` | AST classes, compared with `instanceof` |
| `$B.tokenizer(src, filename, 'file')` | iterable of tokens, used to highlight Python with Python's own tokenizer |
| `$B.Parser` | its presence is how `compile.cjs` knows the parsing chain has loaded on top of the runtime, and a page that never compiles never defines it. `new $B.Parser(src, filename, 'file')` is also how `templateDots` parses one template function |
| `$B._PyPegen.run_parser(parser)` | returns the AST of what `parser` holds, with `lineno`, `col_offset`, `end_lineno` and `end_col_offset` counted in characters; `templateDots` rewrites the dots of the markup at those places |
| `$B.unindent(src)` | Brython's own, the one it already runs on every `<script type="text/python">`; it hands the source back untouched as soon as one non-blank line starts at column zero |
| `$B.file_cache[filename]` | where `compiler_error` looks for the source to quote. Filling it is what turns a bare message into a message with the offending line under it |
| `$B._PySymtable_Build(ast, filename, $B.future_features(ast, filename))` | Python's symbol table for a module, the analysis CPython's `symtable` gives: the module's block, each with `symbols` and `children`. `globalReads` asks it which names some block **reads as a global**, so a parameter or a local called `host` does not bind `$host()` |
| `$B.SYMBOL_FLAGS` | the flags of a symbol: `USE`, `DEF_BOUND`, and the scope held at `SCOPE_OFFSET` under `SCOPE_MASK`, `GLOBAL_IMPLICIT` and `GLOBAL_EXPLICIT` among them. `moduleBinds` reads the module's bound names off it, and the check of `__all__` where each write of it resolves |
| `$B.$delete(name, locals, inum)` | what a real `del name` compiles to, `locals` being the namespace or `'global'`, the frame's globals then being `$B.frame_obj.frame[3]`; distinct from `$B.delete_for_reassign`, which precedes a rebinding. Wrapped so that deleting a name `bind` publishes hides its accessor instead of doing nothing |
| `$B.name_error(name)` | the `NameError` a deleted name raises when read, the shape `delete_for_reassign` already expects of a deleted name |
| `$B.str_dict_get(symbols, name, 0)` | a symbol's flags, `0` when the block does not know the name |
| `node[$B.ID]` | the id Brython writes on an AST node as it builds the symbol table, which is the `id` of the block that node opens: how a `def`, a `class`, a lambda or a comprehension finds its block |
| `$B.id_counter(n)` | sets the counter the code generator numbers functions with and returns its previous value; carried as a commit proposed upstream, since the counter is private there. `compile()` draws it from the file's path so one source compiles to one text, and gives it back after |
| `$B.KW` | the symbol a call's keyword arguments travel under, as a trailing `{[$B.KW]: [named, ...unpacked]}`; carried as a commit proposed upstream. The helpers and the JavaScript call adapter read it to tell keywords from an argument, which no Python dict or JavaScript object can pass for |
| `$B.lambda_magic` | the tag in every generated lambda's name, drawn at random per process; set and given back beside the counter |

`py2js` derives the namespace identifier from **`filename` alone**: `module` and
`locals_id` are ignored by `js_from_root`.

Token type codes read off the tokenizer: `NAME 1`, `NUMBER 2`, `STRING 3`,
`NEWLINE 4`, `OP 55`, f-string parts `59/60/61`, `COMMENT 65`, `NL 66`,
`ENCODING 68`, `ENDMARKER 0`.

### Namespaces and name resolution

| | |
|---|---|
| `$B.namespace(name)` | intercepted; the whole design hangs here |
| `ns.$proxy = true` | makes `resolve_in_namespace` read the property normally instead of demanding an *own* property, the only place in Brython that consults this flag, and what lets accessors live on the prototype |
| `$B.resolve_global(name, ns)` | not called, and the reason `$proxy` exists: it is the function that would demand an own property. It is here because it is the member whose disappearance would stop the whole namespace trick, and the one nobody would think to grep for |
| `$B.delete_for_reassign(name, ns)` | emitted before rebinding a global; its `delete` is why accessors must be inherited, never own |
| `$B.set_lineno(frame, N)` | emitted throughout the generated code; enough to build a line-level source map |
| `$B.frame_obj` | read by `$B.$import`, null until a module body runs |
| `$B.leave_frame()` | called in the success path handed to `browser.aio.run` |

### Objects

| | |
|---|---|
| `$B.$getattr(obj, name)` | Python attribute protocol |
| `$B.get_class(obj)` | class of a Python object. **It probes the object's symbols**, so it must never be called on a foreign proxy that records reads |
| `$B.builtins` | `str.$factory`, `bool.$factory`, `dict.$factory`, `set.$factory`, `list.$factory`, `repr`, `None`, `type` |
| `$B.coroutine` | compared against `get_class` to spot a coroutine without calling `aio.iscoroutine` |
| `$B.$call(callable, ...args)` | calls anything Python calls, a class object included, which is how a class handed to JavaScript is constructed |
| `$B.jsobj2pyobj(value)` | every value coming back from a JavaScript call, so the most-used inbound function there is and the one whose shape changing upstream would be felt first |
| `$B.PYOBJ_MAP` | the WeakMap holding a converted container's back-reference to the Python object it came from, so the original is handed back rather than a copy. Read with `?.`, which is why a rename upstream would be silent and why a test names it |
| `$B.is_dict(obj)` | whether a value is a Python dict, answered from a flag on the object rather than by probing its symbols, which is what `get_class` would do. `urlencode` asks it to tell a mapping from every other Python object, all of which are objects here too |
| `$B.method_wrapper` | the class of a **special method read off a builtin**: `rows.__setitem__` kept in a name is one of these, an object rather than a function, so a wrapper that follows mutators has to recognise it by class and call it with `$B.$call` |
| `$B.method_descriptor` | the class of a **method read off a type**: `list.append` kept in a name. Also an object, and the one whose target is the caller's first argument rather than a receiver it carries |
| `descriptor.sm_callable` | the function inside a `staticmethod`, which is what a class dictionary holds for one. A `@staticmethod def __call__` is found by the lookup above as this object, and reading it as though it were the function made an instance that Python calls perfectly well cross as something JavaScript cannot call. It also says the arity is the whole signature: a static call carries no receiver to leave out |
| `$B.method` | the class of a **bound method**, `{ob_type: method, im_func, im_self}` built fresh on every read (`descriptors.js`, `tp_new`). `typeof` calls it an object, so the boundary that decides what to adapt asks for this class instead: *callable in Python* is wider than *is a JavaScript function* |
| `$B.search_in_dict(cls, name, absent)` | a name looked up in **one** class dictionary, rather than through the attribute protocol, so nothing of the author's runs. It stops at the class it is given: the bases are the caller's to walk, and Brython's own `super.__getattribute__` does exactly that, asking once per class of `tp_mro`. This line used to say *and its bases*, and two boundaries were written against the sentence rather than against the function — an instance whose `__call__` came from a base class was callable from nowhere, and a subclass inheriting `__slots__` without redeclaring them crossed with its fields gone |
| `$B.NULL` | Brython's *absent*, which is not `None`: what `search_in_dict` gives back when the name is nowhere in that class |
| `cls.tp_mro` | a class's method resolution order, starting at the class itself: `[cls, ...bases, object]`. What a lookup walks when it means *declared here or above*, and what says a subclass of `set` is a set |
| `$B.class_name(obj)` | the name Python prints for a value's class, `range` or `complex`, which is what a refusal has to say when it has nothing else: the serialiser's message names the class of the value rather than accusing the value of being one |
| `$B.search_slot(cls, slot, absent)` | one of the engine's own slots looked up through a class's MRO, `tp_iternext` being the one read here. It is how `iter()` itself decides whether something is an **iterator** rather than merely iterable, which is the difference between an argument that still holds what it was given and one that has handed it all over |
| `$B.make_js_iterator(value, frame)` | a Python iterable walked as a JavaScript one. It runs `iter()`, which is the only call that **validates** the protocol — an `__iter__` returning a plain list is a `TypeError`, and `list()` never notices because its argument is iterable either way. It also keeps the storage fast path where it is still true: Brython copies that path onto a subclass only when the subclass leaves `__iter__` alone, so this is one call for both halves of the question. `$B.NULL` as the frame is the engine's own spelling for *called from JavaScript*, and without it a line number is written into whatever frame happens to be current |
| `$B.$list(array)` | a JavaScript array made into a Python list in place. `list.$factory` is the road for anything else, but it copies the storage of **any** array-shaped argument, subclass included, so it answers the question of what iterating a subclass means with the question |
| `$B.rich_comp(op, x, y)` | Python's comparison protocol. `bind:group` asks it for `==`, because a Brython float is an object and JavaScript's `===` would answer false for two evaluations of the same literal |
| `value.$kw` | how a **keyword call** reaches a JavaScript function: one extra positional argument, an object whose `$kw` is an array — entry 0 holds the literal keywords, the rest are the dicts a `**` spread contributed. Brython's own `pyargs2jsargs` refuses such a call, since a JavaScript function carries no parameter names to place them by; a call made through a proxy does not go down that path, so the refusal is re-raised where the proxy is. The injected helpers are the exception and for one reason: **their** names are ours |
| `$B.keyword_is_empty(kw)` | whether that array carries any name at all. `f(x, **{})` is not a keyword call, and a Python program writes one whenever the mapping it spreads happens to be empty |

### Dispatch points, for reactivity

Every mutation a Python program makes goes through one of these, which is what
lets an in-place mutation become reactive without proxying anything. An object
that carries no marker pays one property miss.

| | |
|---|---|
| `$B.call_attr(obj, name, nargs, ...)` | every method call written on the object |
| `$B.$getattr(obj, name)` | a method taken off the object and called later, `add = xs.append`. `$B.$getattr_pep657` delegates here and so does the builtin `getattr`, so this one covers all three and they must not be wrapped as well |
| `$B.augm_assign(left, op, right)` | `row += [1]`, `d \|= other`; every operator with an `=` after it. They mutate and rebind the name to the same object, so a watched container changes without a watched name being written. A *different* object back is a rebinding, which the accessor already answers for |
| `$B.$setitem(obj, key, value)` / `$B.$delitem` | `d[k] = v`, `del d[k]` |
| `$B.$getitem(obj, key)` | every indexed read, the hottest of them |
| `$B.$setattr(obj, name, value)` / `$B.$setattr1` | attribute writes; Brython emits one or the other depending on the statement, and both have to be covered |
| `$B.$delattr(obj, name)` | `del obj.attr` |

A container reached out of a watched one is watched too, and that is settled on
the way **in** rather than on the way out: marking a container walks what is
already inside it, and the mutators above hand the watch to what arrives
afterwards. Covering the entrances is what leaves reading alone, so Brython's own
iteration, `reversed()` and `list()` need no hook at all.

The walk is bounded to what Python calls a container, an array or a dict by
`$B.get_class`. Walking any object's keys let it leave the author's data: it
reached `__BRYTHON__` itself, 558 keys, and from there `localStorage`, which is a
`Storage` and turns every value it is given into a string, so the marker came
back as its own source text.

Wrap them with rest arguments, `function (a, b, ...rest)`, and never with
`arguments` + `apply`: these are the hottest functions Brython has, and the old
form blocks V8's optimiser enough to be visible on a page load.

An instance's attributes live under a **private symbol** (`Symbol('DICT')`, not
`Symbol.for`), and Brython publishes it as **`$B.DICT`** (`py_type.js`). Reading
it there rather than discovering it from an object is not a convenience: a
discovery has to start somewhere, and the object it starts from decides what the
runtime can see afterwards. Skipping arrays during that discovery — a plain list
carries no such dictionary — meant a **list subclass**, which is an array *and*
carries one, could never teach it, so its attributes went unwatched whenever it
was the first such object seen. A dict's keys, by contrast, are ordinary
enumerable JavaScript properties.

### Modules

| | |
|---|---|
| `$B.imported[name]` | module registry; a store publishes its namespace here so component Python can `import` it |
| `$B.VFS`, `$B.update_VFS(scripts)`, `$B.use_VFS` | how a module reaches Brython without a network fetch; entries are `[ext, source, deps]`. Svelthon registers none: the VFS is how a stdlib is delivered, and a need that is identified becomes a builtin of ours instead |
| `$B.imported._sys` | the interpreter's own module, installed by brython.js like `browser`: `_getframe`, `modules`, `path`, the streams. It is what stack introspection reaches now that `sys` is gone |
| `$B.imported['browser.html']` | consulted to pick a DOM node's Python class from its tagName; registered by brython.js itself, but only by its browser half |
| `$B.isNode` | `typeof process !== 'undefined' && process.release.name === 'node'`, decided at load. It picks which half of brython.js is installed: the browser half is the one that defines `browser.html`, `browser.window` and the DOM wrappers |
| `browser.aio` | `run(coro, onsuccess, onerror)`, `iscoroutine`, `sleep` |

## Representation choices Svelthon relies on

These are what make the Python/JavaScript boundary usable at all, and each one
had to be discovered by measurement.

**Transparent to JavaScript.** A `list` *is* a JS `Array`; a `tuple` too. A `str`
is a JS string, an `int` a number (or `BigInt` beyond 2⁵³), a `bool` a boolean. A
`dict`'s string keys are exposed as JS properties. This is why `{#each}` iterates
a Python list natively and why `{...some_dict}` spreads.

**Opaque to JavaScript.** An instance's attributes are **not** JS properties, and
neither is a class's `__name__`: both need `$B.$getattr`. An exception carries
no `message` and no `stack`, but does carry `__traceback__`, `lineno` and `args`.
`None` is an object, so `String(None)` gives `[object Object]` unless a
`toString` is added.

**Never wrap a Brython value in a JS Proxy.** A proxied object fails Brython's own
type checks: `repr((1, 2))` raises *descriptor `__repr__` requires a 'tuple'
object but received a 'tuple'*. This is why Svelthon stores Python values in
`$state.raw` and publishes them through accessors rather than handing Svelte a
`$state` proxy.

## Bootstrap outside a browser

`brython.js` is a classic browser script. To run it under Node, which Svelthon
does at build time and again for server-side rendering, four things must be in
place **before** it is evaluated:

```js
globalThis.self ??= globalThis;           // touched by the bootstrap
globalThis.addEventListener ??= () => {};
globalThis.__BRYTHON__ ??= { brython_path: '<absolute URL>' };
globalThis.$B ??= globalThis.__BRYTHON__; // the codegen's eval() resolves $B globally
```

`brython_path` must be pre-set because `document.currentScript` is `null` in an ES
module, and it must be an **absolute URL** because `$B.strip_host` feeds it to
`new URL()`. The `$B` global is required because the code generator builds its AST
classes with `eval`, whose code resolves `$B` in global scope, not module scope.

## Rough edges worth smoothing

Not bugs, but each cost real debugging time because the failure gave no clue.

**`$B.$import` before any module body has run** dies with
`Cannot read properties of null (reading 'frame')`: it reads `$B.frame_obj`,
which is null at that point. It brings the whole runtime down. A guarded error
naming the cause would save the next person an hour.

**Wrapping a DOM node while `browser.html` is unregistered** dies with
`Cannot read properties of undefined (reading 'Symbol(DICT)')`, from
`$B.module_getattr($B.imported['browser.html'], obj.tagName)`. The message points
nowhere near the cause, which is that brython.js installed its Node half rather
than its browser one, see `$B.isNode` below.

**A `type` mismatch message can contradict itself.** A proxied tuple produces
*requires a 'tuple' object but received a 'tuple'*: accurate about the class
name, useless about the identity check that actually failed. Mentioning that the
two classes differ would make it diagnosable.
