# What SVELTHON asks of Brython

SVELTHON compiles Python to JavaScript with Brython and wires the result to
Svelte's signals. Almost none of what it touches is a public API — it is the
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
bindings — Python semantics require it, for `globals()`, `exec`, and dynamic name
resolution. SVELTHON replaces that object with one whose every property is an
accessor onto a Svelte signal, and every assignment the code generator already
emits becomes a reactive write.

The substitution happens at run time, by swapping `$B.namespace` for the duration
of the module body (and only for the requested name, since an import during
initialisation creates its own namespace through the same function).

**If this shape changed, SVELTHON would stop working entirely.** It is the only
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

`py2js` derives the namespace identifier from **`filename` alone** — `module` and
`locals_id` are ignored by `js_from_root`. See the first bug below.

Token type codes read off the tokenizer: `NAME 1`, `NUMBER 2`, `STRING 3`,
`NEWLINE 4`, `OP 55`, f-string parts `59/60/61`, `COMMENT 65`, `NL 66`,
`ENCODING 68`, `ENDMARKER 0`.

### Namespaces and name resolution

| | |
|---|---|
| `$B.namespace(name)` | intercepted; the whole design hangs here |
| `ns.$proxy = true` | makes `resolve_in_namespace` read the property normally instead of demanding an *own* property — the only place in Brython that consults this flag, and what lets accessors live on the prototype |
| `$B.delete_for_reassign(name, ns)` | emitted before rebinding a global; its `delete` is why accessors must be inherited, never own |
| `$B.set_lineno(frame, N)` | emitted throughout the generated code; enough to build a line-level source map |
| `$B.frame_obj` | read by `$B.$import`, null until a module body runs |
| `$B.leave_frame()` | called in the success path handed to `browser.aio.run` |

### Objects

| | |
|---|---|
| `$B.$getattr(obj, name)` | Python attribute protocol |
| `$B.get_class(obj)` | class of a Python object — **it probes the object's symbols**, so it must never be called on a foreign proxy that records reads |
| `$B.builtins` | `str.$factory`, `bool.$factory`, `dict.$factory`, `set.$factory`, `list.$factory`, `repr`, `None`, `type` |
| `$B.coroutine` | compared against `get_class` to spot a coroutine without calling `aio.iscoroutine` |

### Dispatch points, for reactivity

Every write a Python program makes goes through one of these, which is what lets
an in-place mutation become reactive without proxying anything. An object that
carries no marker pays one property miss.

| | |
|---|---|
| `$B.call_attr(obj, name, nargs, ...)` | every method call |
| `$B.$setitem(obj, key, value)` / `$B.$delitem` | `d[k] = v`, `del d[k]` |
| `$B.$getitem(obj, key)` | every indexed read — the hottest of them, and where a nested container comes under watch |
| `$B.$setattr(obj, name, value)` / `$B.$setattr1` | attribute writes; Brython emits one or the other depending on the statement, and both have to be covered |
| `$B.$delattr(obj, name)` | `del obj.attr` |

Wrap them with rest arguments — `function (a, b, ...rest)` — and never with
`arguments` + `apply`: these are the hottest functions Brython has, and the old
form blocks V8's optimiser enough to be visible on a page load.

An instance's attributes live under a **private symbol** (`Symbol('DICT')`, not
`Symbol.for`), so it has to be discovered once from an object and cached. A
dict's keys, by contrast, are ordinary enumerable JavaScript properties.

### Modules

| | |
|---|---|
| `$B.imported[name]` | module registry; a store publishes its namespace here so component Python can `import` it |
| `$B.VFS`, `$B.update_VFS(scripts)`, `$B.use_VFS` | entries are `[ext, source, deps, is_package]`; the precomputed `deps` make the transitive closure of a component's imports exact without reparsing |
| `$B.imported['browser.html']` | consulted to pick a DOM node's Python class from its tagName |
| `browser.aio` | `run(coro, onsuccess, onerror)`, `iscoroutine`, `sleep` |

## Representation choices SVELTHON relies on

These are what make the Python/JavaScript boundary usable at all, and each one
had to be discovered by measurement.

**Transparent to JavaScript.** A `list` *is* a JS `Array`; a `tuple` too. A `str`
is a JS string, an `int` a number (or `BigInt` beyond 2⁵³), a `bool` a boolean. A
`dict`'s string keys are exposed as JS properties. This is why `{#each}` iterates
a Python list natively and why `{...some_dict}` spreads.

**Opaque to JavaScript.** An instance's attributes are **not** JS properties, and
neither is a class's `__name__` — both need `$B.$getattr`. An exception carries
no `message` and no `stack`, but does carry `__traceback__`, `lineno` and `args`.
`None` is an object, so `String(None)` gives `[object Object]` unless a
`toString` is added.

**Never wrap a Brython value in a JS Proxy.** A proxied object fails Brython's own
type checks — `repr((1, 2))` raises *descriptor `__repr__` requires a 'tuple'
object but received a 'tuple'*. This is why SVELTHON stores Python values in
`$state.raw` and publishes them through accessors rather than handing Svelte a
`$state` proxy.

## Bootstrap outside a browser

`brython.js` is a classic browser script. To run it under Node — which SVELTHON
does at build time, and again for server-side rendering — four things must be in
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
character that cannot appear in an identifier, not just `.` — see below. Note
that the *module id* beside it (the argument to `$B.namespace`, and the frame
name) keeps the `/`: it is a string, so it is valid as it stands, and leaving it
alone keeps `__name__` recognisable.

### A comprehension's variable leaks into the enclosing scope

```python
[q for q in range(3)]
q                      # CPython 3.12: NameError. Brython: 0, 1 or 2.
```

It leaks **both** at module level and inside a function — the loop variable of a
comprehension has had its own scope since Python 3.0. Verified against CPython
3.12.3, where both cases raise `NameError`.

SVELTHON's suite marks this with a `test.fails`, so the day it is fixed upstream
the test speaks up rather than silently passing.

### `FSTRING_MIDDLE` reports the position of the token that opened the f-string

```python
seen = f"{len(items)} items"
```

The tokenizer emits, in order, `FSTRING_START` `f"` at columns 7–9, then the
tokens of `{len(items)}` at 9–21, then `FSTRING_MIDDLE` `" items"` at **7–13**,
then `FSTRING_END` at 27–28. The middle chunk's own text sits at 21–27; the
positions reported are those of the start token.

Anything consuming the token stream positionally — a syntax highlighter, an
editor, a formatter — walks backwards at that point and re-emits text it has
already seen. SVELTHON's demo highlighter (`src/Highlight.svelte`) works around
it by ignoring a token that starts before the cursor.

### `pyobj2jsobj` stamps every converted container with `Symbol(PYOBJ)`

Converting a `dict` or a `list` to JavaScript leaves a back-reference on the
result — `jsobj[PYOBJ] = pyobj`. Any Web API whose argument is a WebIDL
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
property non-enumerable does **not** help — measured: a record conversion walks
own keys before it filters on enumerability. Holding the back-reference in a
`WeakMap` keyed by the JavaScript object, instead of as a property on it, would
fix it without changing the caching behaviour.

SVELTHON works around it by converting such arguments itself (`to_js`, i.e.
`plainData`), which produces a plain object carrying no symbol.

### A debug `console.log` is left in `$B.JSClass.tp_getattro`

```js
$B.JSClass.tp_getattro = function(self, attr){ console.log('JSClass getatro', self, attr)
```

It fires on **every** attribute access on a JavaScript class from Python —
`js.Response.new` is enough — and dumps the class object, which is hundreds of
lines. Note the typo in the message. Removing the line is the whole fix.

## Patches applied to the vendored build

`vendor/brython.js` is byte-identical to upstream. Repairs are applied as it is
served, by `VENDOR_PATCHES` in `src/lib/svelthon.js`, so that dropping in a newer
Brython makes a patch that no longer matches **fail the build** rather than
silently do nothing. Each entry states what it repairs and how many times it must
match.

| Patched | Why |
|---|---|
| the debug `console.log` in `$B.JSClass.tp_getattro` | it fires on every attribute access on a JavaScript class from Python and dumps the class object; two requests through `js.*` filled the server log with hundreds of lines |
| the `Symbol(PYOBJ)` back-reference, moved to a `WeakMap` | a stamped container is refused by any Web API taking a WebIDL record, `new Response(body, {headers})` first among them |

The second is nine sites — five writes and four reads, one of them through
`Object.hasOwn` — so each is its own entry with its own expected count. The
symbol stays declared and published as `$B.PYOBJ`; only the reads and writes move
to `$B.$svelthonPyobj`, keyed by the JavaScript object. The round-trip cache
behaves as before, and `scripts/browser-check.sh` covers the DOM node path, which
is the one where identity across the boundary is observable.

Both are worth carrying upstream — the first is a deleted line, the second
belongs in `www/src/js_objects.js` where it can be written against the readable
source.

### The one edit made in the file itself

`qualified_scope_name` is patched **in `vendor/brython.js` directly**, marked
with a `/* SVELTHON patch */` comment. It cannot go through `VENDOR_PATCHES`,
which is a Vite plugin: this code runs in the *compiler*, which `compile.cjs`
loads with a plain `require` under Node, where no Vite transform applies.

A direct edit is lost silently when a newer Brython is vendored, so the guard is
a test rather than a build-time check — *a path builds a valid identifier, and
`__file__` keeps the real path*, in `tests/compiler.test.js`. It fails the moment
the patch is gone. What it buys: `compile.cjs` passes the real path, so
`__file__` names the actual file and a traceback reads
`src/routes/+page.server.py` instead of a slug.

## Rough edges worth smoothing

Not bugs, but each cost real debugging time because the failure gave no clue.

**`$B.$import` before any module body has run** dies with
`Cannot read properties of null (reading 'frame')` — it reads `$B.frame_obj`,
which is null at that point. It brings the whole runtime down. A guarded error
naming the cause would save the next person an hour.

**Wrapping a DOM node while `browser.html` is unimported** dies with
`Cannot read properties of undefined (reading 'Symbol(DICT)')`, from
`$B.module_getattr($B.imported['browser.html'], obj.tagName)`. The message points
nowhere near the cause, which is a missing import.

**A `type` mismatch message can contradict itself.** A proxied tuple produces
*requires a 'tuple' object but received a 'tuple'* — accurate about the class
name, useless about the identity check that actually failed. Mentioning that the
two classes differ would make it diagnosable.
