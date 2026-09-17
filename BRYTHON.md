# What Svelthon asks of Brython

Svelthon compiles Python to JavaScript with Brython and wires the result to
Svelte's signals. Almost none of what it touches is a public API: it is the
shape of Brython's internals. This file is the contract, so that a Brython change
can be checked against it, and so that whoever reads `src/lib/` knows which
assumptions are load-bearing.

Verified against the vendored `brython.js`, `$B.version_info == [3, 14, 0]`.

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
| `$B.Parser` | not called: its presence is how `compile.cjs` knows the parsing chain has loaded on top of the runtime. A page that never compiles never defines it |
| `$B.unindent(src)` | Brython's own, the one it already runs on every `<script type="text/python">`; it hands the source back untouched as soon as one non-blank line starts at column zero |
| `$B.file_cache[filename]` | where `compiler_error` looks for the source to quote. Filling it is what turns a bare message into a message with the offending line under it |

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
| `$B.method` | the class of a **bound method**, `{ob_type: method, im_func, im_self}` built fresh on every read (`descriptors.js`, `tp_new`). `typeof` calls it an object, so the boundary that decides what to adapt asks for this class instead: *callable in Python* is wider than *is a JavaScript function* |
| `$B.search_in_dict(cls, name, absent)` | a name looked up in a class **and its bases**, through the class dictionaries rather than the attribute protocol, so nothing of the author's runs. The converter asks a class whether it declares `__slots__`: an instance whose slots are all still unassigned carries no storage to be recognised by, and a plain JavaScript object carrying a property that merely looks like one must not be mistaken for it |
| `$B.NULL` | Brython's *absent*, which is not `None`: what `search_in_dict` gives back when the name is nowhere in the class |
| `$B.rich_comp(op, x, y)` | Python's comparison protocol. `bind:group` asks it for `==`, because a Brython float is an object and JavaScript's `===` would answer false for two evaluations of the same literal |

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

## Bugs

### A `filename` containing `/` produces invalid JavaScript

**Fixed upstream**, `filename-invalid-identifier-chars`.

The namespace identifier is derived from `filename`, and only `.` is neutralised:

```js
$B.py2js({ src: 'x = 1\n', filename: 'a/b.py' }, 'm', ['m']).to_js()
```

```js
var $B = __BRYTHON__,
    _b_ = $B.builtins,
    locals_a/b_py = $B.namespace('a/b_py'),   // SyntaxError: Unexpected token '/'
```

Any real path triggers it, silently, since the failure only appears when the
generated code is evaluated.

**Patched in the vendored build.** `qualified_scope_name` now neutralises every
character that cannot appear in an identifier, not just `.`, see below. Note
that the *module id* beside it (the argument to `$B.namespace`, and the frame
name) keeps the `/`: it is a string, so it is valid as it stands, and leaving it
alone keeps `__name__` recognisable.

### A comprehension's variable leaks into the enclosing scope

**Fixed upstream**, `comprehension-leaks-target`.

```python
[q for q in range(3)]
q                      # CPython 3.12: NameError. Brython: 0, 1 or 2.
```

It leaks **both** at module level and inside a function: the loop variable of a
comprehension has had its own scope since Python 3.0. Verified against CPython
3.12.3, where both cases raise `NameError`.

**Patched in the vendored build.** Two things had to change together, which is
why a first attempt at only the first appeared to do nothing:

- **The binding.** `make_comp` already saves and restores any name that existed
  before the comprehension, so only a name it *introduced* survives. That one is
  now deleted from the namespace after the loop.
- **The scope entry.** Storing the iteration variable registers it in the
  enclosing scope's `locals`, and that set is what `name_scope` consults: a later
  bare read compiled to a direct `locals_X.q`, which yields `undefined` instead
  of raising. Dropping the name from `locals` makes the read compile to
  `$B.resolve_in_scopes`, exactly as for a name never assigned.

Anchoring matters. Both belong at the *late* site, beside the `save_locals`
restore loop. The `save_target_flags` restore that appears earlier in `make_comp`
runs before the loop body has been assembled, so appending there puts the
statement inside the loop.

Covered by four tests in `tests/fidelity.test.js`: module level, inside a
function, six comprehension forms, and a name that existed beforehand. Two of
them were `test.fails` until the patch landed; they now guard it.

With this one repaired, `BRYTHON.md` lists no open bug and the suite carries no
`test.fails` at all. That marker means one thing here, *upstream is wrong, say
so the day it is fixed*, and nothing currently qualifies. A third party's
deliberate behaviour, such as Svelte memoising a `$derived` on `===`, is asserted
as it stands instead.

### `FSTRING_MIDDLE` reports the position of the token that opened the f-string

**Fixed upstream**, `fstring-middle-position`.

```python
seen = f"{len(items)} items"
```

The tokenizer emits, in order, `FSTRING_START` `f"` at columns 7–9, then the
tokens of `{len(items)}` at 9–21, then `FSTRING_MIDDLE` `" items"` at **7–13**,
then `FSTRING_END` at 27–28. The middle chunk's own text sits at 21–27; the
positions reported are those of the start token.

Anything consuming the token stream positionally, a syntax highlighter, an
editor, a formatter, walks backwards at that point and re-emits text it has
already seen.

**Patched in the vendored build.** The chunk's start cannot be derived from the
buffer: `{{` adds one character to it for two in the source, and escapes do the
same. So it is recorded where a chunk *begins*, the single point where
`ft_buffer` (or `format_specifier`) is reset, on the first iteration after the
tokenizer enters that mode, and each of the five emissions then reports its own
span.

The column of the character just consumed is `pos - line_start - char.length + 1`:
`pos` has already moved past it, `line_start` starts at 1, and `char` holds two
code units for a surrogate pair and three for a closing triple quote. That one
expression covers every site.

Covered by *an f-string chunk reports its own position* in
`tests/compiler.test.js`, which slices the source at the reported offsets and
compares, including a `{{literal}}`, where the span is legitimately wider than
the token's decoded text.

### `pyobj2jsobj` stamps every converted container with `Symbol(PYOBJ)`

**Fixed upstream**, `pyobj-backref-weakmap`.

Converting a `dict` or a `list` to JavaScript leaves a back-reference on the
result, `jsobj[PYOBJ] = pyobj`. Any Web API whose argument is a WebIDL
`record<K, V>` then rejects it, because a record conversion refuses an own symbol
key:

```python
js.Response.new(body, {"headers": {"content-type": "application/json"}})
```

```
TypeError: Key Symbol(PYOBJ) in undefined.headers is a symbol,
           which cannot be converted to a ByteString.
```

`Headers` and `URLSearchParams` both throw; a *list* of pairs is accepted, and so
are `JSON.stringify` and `Object.assign`, which ignore symbol keys. Making the
property non-enumerable does **not** help, measured: a record conversion walks
own keys before it filters on enumerability. Holding the back-reference in a
`WeakMap` keyed by the JavaScript object, instead of as a property on it, would
fix it without changing the caching behaviour.

Svelthon works around it by converting such arguments itself (`to_js`, i.e.
`plainData`), which produces a plain object carrying no symbol.

### A debug `console.log` is left in `$B.JSClass.tp_getattro`

**Fixed upstream**, `remove-jsclass-getattro-debug-log`.

```js
$B.JSClass.tp_getattro = function(self, attr){ console.log('JSClass getatro', self, attr)
```

It fires on **every** attribute access on a JavaScript class from Python,
`js.Response.new` is enough, and dumps the class object, which is hundreds of
lines. Note the typo in the message. Removing the line is the whole fix.

### An `IndentationError` names the line after the last one

Measured on four sources, and the pattern is exact: the reported line is always
the end of the file plus one, never the offending line:

| source | reported |
|---|---|
| 2 lines, indented | `:3` |
| 4 lines, indented | `:5` |
| 10 lines, indented | `:11` |
| 4 lines, the error genuinely on line 4 | `:5` |

So an author who indents a block is told about a line that does not exist. It is
the first error anyone will meet coming from JavaScript, where the same
indentation is whitespace, and it is the least helpful one Brython produces.

Nothing in Svelthon works around it: what it does instead is **remove the
occasion**, by unindenting a component's script the way Brython already unindents
its own `<script type="text/python">`. The message still appears for a `.py`
file, or for a block whose indentation is genuinely inconsistent, and in that
last case Svelthon adds a line naming the one that is out of line, since Brython
points at the first line of the block instead.

### `unindent` is private, and it is the one function an embedder wants

**Fixed upstream**, `expose-unindent`.

`vendor/brython.js:14264`. Brython runs it on the body of every
`<script type="text/python">` before compiling:

```js
src = (script.innerHTML || script.textContent)
src = unindent(src)
```

Its rule is `textwrap.dedent`'s, the minimum indentation over non-blank lines,
with a conservative bail: if any non-blank line is already at column zero, the
source is returned untouched rather than mangled. Blank lines are kept as they
are, so the line count never moves.

That is exactly what any tool embedding Python in markup needs, and it is not
reachable: it is a module-level function, absent from `$B`. Exposing it is a
two-word change with no behaviour attached, the smallest of the patches below,
and the most obvious candidate to send upstream.

### `JSObj.to_dict()` leaves arrays as arrays

**Fixed upstream**, `to-dict-array-to-list`.

`www/src/js_objects.js:447`, and the comment on the function above it states the
intent:

> *converts Array to list and converts its items / converts "raw" Object to dict
> and converts its values*

The object half holds. The array half does not:

```js
if(Array.isArray(obj)){
    return obj.map(convert_to_python)
}
```

`Array.prototype.map` returns a JavaScript array, and a JavaScript array is not a
`list`: measured, `isinstance` says False on one and True on the other. So a
tree that came from `JSON.parse` comes back with real dicts at every level and
arrays that no Python test recognises:

```python
d = jsobj.to_dict()
isinstance(d, dict)            # True
isinstance(d["meta"], dict)    # True
isinstance(d["nodes"], list)   # False
```

The same file already spells the repair two hundred lines above, at line 96:
`_b_.list.$factory()`. Wrapping the `map` in it is the whole fix, and `_b_` is in
scope from line 5.

### `compiler_error` assumes the source is in `$B.file_cache`

`vendor/brython.js:14486`. Every compile-time error, as opposed to a parse
error, which takes another path, is raised through this function, which quotes
the offending line:

```js
function compiler_error(ast_obj, message, end) {
    var exc = $B.EXC(_b_.SyntaxError, message)
    exc.filename = state.filename
    if (exc.filename != '<string>') {
        var src = $B.file_cache[exc.filename], lines = src.split('\n'), …
```

`$B.file_cache[exc.filename]` is read without checking. An embedder that calls
`py2js({src, filename})` with a filename it never registered therefore gets

```
TypeError: Cannot read properties of undefined (reading 'split')
```

in place of the message Brython had already written. It affects `await` outside a
coroutine, `return` and `yield` outside a function, `break` and `continue`
outside a loop: the mistakes a beginner makes, and the five where a good message
matters most.

Two ways to repair it upstream, both small: guard the lookup, or fall back to
`exc.text = None` as the `'<string>'` branch already does. Svelthon does not
patch it, since the caller can register the source itself, which is what
`compile.cjs` does before `py2js`, and Brython's own message comes out. It is
CPython's, word for word: `'await' outside function`. Covered by
`tests/compile-errors.test.js`.

### `str.find` hands its `start` to `indexOf` without converting it

`vendor/brython.js`, in `str_funcs.find`:

```js
res = self.indexOf(sub, start)
…
return jspos2pypos(self, res)
```

`start` counts code points; `String.prototype.indexOf` counts UTF-16 units. The
result is converted back, the argument never is. So a character outside the basic
plane sitting before `start` moves the search backwards, and the call answers a
match it was told to skip, for ever, if the caller is walking occurrences:

```python
>>> s = 'a\U0001f600bXbX'
>>> s.find('X', 4)
3      # the match at 4 is never passed
```

`pypos2jspos` is the conversion, defined in the same file and already used at
five other sites. Two other defects live next door, and nothing in Svelthon
reaches them: `str.startswith` has the same omission, and `str.find` does not
normalise a negative `start`: `'abXbX'.find('X', -2)` answers 2 rather than 4,
in plain ASCII.

**Fixed upstream**, one branch each: `find-start-position`,
`startswith-start-position`, `find-negative-start`. The last two arrived in the
vendored build without being asked for, which is what sending a repair upstream
rather than keeping it is for.

## Patches applied to the vendored build

`vendor/brython.js` is built from master plus five proposed commits, with
**two** edits made in the file itself afterwards. The wrapper carries a
`/* SVELTHON patch, see BRYTHON.md */` comment, the only way to find it again in
1.4 MB; the other edit *is* a comment, so `@vite-ignore` finds itself.

The commits are Brython's own, proposed upstream and carried here while they
wait, which is what this project has always done rather than hold a fix back:

| branch | what it changes |
|---|---|
| `none-is-undefined` | `None` and JavaScript's `undefined` become one value seen from two sides, in both directions. `javascript.UNDEFINED` becomes `None`, `null` and `javascript.NULL` are untouched, and `js_array.tp_repr` converts its elements the way the iterator already did |
| `undefined-str-slot` | `UndefinedType` gains the `tp_str` it lacked, so `str()` of a raw JavaScript `undefined` answers instead of raising about a descriptor with no argument |
| `json-big-integers` | `javascript.JSON` reads and writes an integer past 2^53 with its exact digits, the way the `json` module already did. `stringify` no longer raises on a big integer and `parse` no longer hands back an `int` whose last digits are wrong. Both steps compose with an author's replacer or reviver, and both are skipped where the engine lacks `JSON.rawJSON` or the reviver's source text. `from_json` is this `parse` |
| `jsobj2pyobj-exponential` | a whole Javascript number above 2^53 crosses to Python as the int it is. It was built from the number's shortest decimal, which is another integer above 2^53 and exponential notation from 1e21 up, where `BigInt()` refused it outright. `to_py` reaches this on any large number coming back from JavaScript |
| `mark-compiler-chain` | two comments around the parsing chain in the generated `brython.js`, which is what `scripts/vendor-brython.py` cuts on to build `brython_runtime.js` |

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
| the debug print, the `PYOBJ` back-reference, `str.find` | `tests/vendor.test.js` |
| `convert_to_python` | `tests/from_json.test.js`, where an array that stayed one fails `isinstance(x, list)` |
| the file wrapper, the two `@vite-ignore` | `tests/vendor.test.js`, the last two tests |

`scripts/browser-check.sh` covers the DOM node path as well, which is where
identity across the boundary is observable.

The back-reference is read from Svelthon under **Brython's** name for it,
`$B.PYOBJ_MAP`, in `src/lib/runtime.js`. While the WeakMap was a local edit it
was called `$B.$svelthonPyobj`, and the read is written with `?.`, so the
re-vendoring would have turned it into `undefined` without a word. What caught
it is the test that names the map, not the code that uses it.

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
