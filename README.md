# SVELTHON

**Svelte components written in Python, compiled at build time.**

```svelte
<script lang="python">
count = 0

def increment():
    global count
    count += 1
</script>

<button onclick={increment}>increment()</button>
<output>{count}</output>
```

That is the whole thing. Plain Python — no runes, no reactivity API to learn,
no decorators around your state. The browser receives only JavaScript: unlike
every other Python-in-the-browser approach, nothing is transcompiled while the
page loads.

*[Version française](README.fr.md).*

![The SVELTHON demo page: Python source next to the running component](docs/demo.png)

## Why

Python is the most used language in the world, and running it in a browser has
been promised many times — Brython, Skulpt, Transcrypt, PyScript. The barrier
was never the language. It was the workflow: no components, no props, no hot
reload, a compiler shipped to every visitor, and a page that spent its first
second compiling.

SVELTHON keeps the modern frontend chain intact. Components, props, scoped
styles, keyed lists, HMR, tree-shaking — all of it — with Python as the
component language and **no runtime penalty at load**, because the compilation
already happened.

## Quick start

```sh
npm install
npm run dev
```

```sh
npm test             # 137 tests: semantics, props, reactivity, Svelte surface
npm run test:browser # DOM interop and the demo, in a real headless Chromium
npm run test:hmr     # virtual-module invalidation, component and store paths
npm run bench        # Python vs JavaScript, same component, real browser
npm run build
```

## The idea

Brython keeps a module's state in a **namespace object**, never in lexical
bindings:

```js
locals_Counter = $B.namespace('Counter')
locals_Counter.count = 0
```

So there is exactly **one point to intercept**: that single call to
`$B.namespace()`. The runtime hijacks it for as long as the module body runs and
hands back an object whose every name is an accessor onto a Svelte signal. Every
assignment Brython's code generator already emits becomes a reactive write —
without rewriting a line of generated code.

The hijack is by name: a module body may import others while it runs, and each
import creates its namespace through the same function. The expected pattern is
only *checked* at compile time — if a future code generator stopped emitting it,
the build fails loudly instead of shipping a component with no reactivity.

## The API, and what it replaces

Seven names, and nothing to import: they are injected into the module's namespace,
and a component that defines its own keeps it. Each one stands where a rune
stands in JavaScript.

| Python | Svelte 5 |
|---|---|
| `count = 0` | `let count = $state(0)` |
| `name: str` | `let { name } = $props()` |
| `size: int = 3` | `let { size = 3 } = $props()` |
| `value: str = bindable()` | `let { value = $bindable() } = $props()` |
| `@derived` | `$derived.by(…)` |
| `@effect` | `$effect(…)` |
| `def on_mount()` / `on_destroy()` | `onMount()` / `onDestroy()` |
| `set_context(k, v)` / `get_context(k)` | `setContext(k, v)` / `getContext(k)` |
| `to_js(value)` | — a Python container made readable from JavaScript |
| `js` | — the JavaScript globals: `js.Response`, `js.JSON`, `js.URL` |
| `items.append(x)` | `items.push(x)` — `$state` proxies deeply |

The last row is the one that costs work rather than a rename — see
[Reactivity](#reactivity-one-signal-per-name) for how an in-place mutation is
caught without a proxy.

There is no `$state` equivalent to write, because there is nothing to declare: a
module-level assignment already *is* the declaration, and the compiler reads it
from the AST.

## Compilation pipeline

```
 Counter.svelte
   └── <script lang="python">
         │
         │  Svelte preprocessor (src/lib/svelthon.js)
         ↓
       $B.py2js()  ← Brython, under Node          [build time]
         │
         ├──→ virtual module  virtual:svelthon/<name>
         │      export function init(__py) { …generated code… }
         │
         └──→ component script
                let count = $state.raw(undefined);
                bind(__proto, 'count', () => count, (v) => { count = v; });
                const __py = Object.create(__proto);
                __py.$proxy = true;
                init(__py);
                const increment = (...a) => __fn_increment(...a.slice(0, 0));
```

The generated code lives in a separate module because **Svelte forbids the `$`
prefix on any declaration inside a component**, in every scope — and Brython's
code generator opens with `var $B = __BRYTHON__`. An IIFE is not enough; it takes
a file Svelte never parses.

## Props: the annotation is the interface

Like a dataclass — annotated is public, assigned is internal.

```python
name: str              # required prop
punct: str = "!"       # prop with a default
greeting = "Hello"     # internal state, invisible to the parent
```

A prop is readable while the module body runs, a parent update flows through to
Python, and a required prop that was not passed reads as `None`, not
`undefined`. Writing to a prop from Python only takes effect when the parent
supplies nothing — Svelte's own rule for non-`$bindable` props.

Reading a global goes through `$B.resolve_global`, which demands an *own*
property unless the namespace carries the `$proxy` flag — in which case it reads
the property normally and therefore walks the prototype chain. It is the only
place in Brython that consults that flag, and it is what makes the prototype
trick compatible with props.

## Templates are Python

Every expression a template *reads* is compiled as Python. Each site becomes a
hidden function appended to the module, and the markup calls it:

```svelte
{#if rows}                    <!-- {#if __expr_0()}     def __expr_0(): … -->
  {#each rows as r}
    <li data-id={r.id}>{r.label}</li>
  {/each}
{/if}
```

Block variables are passed as arguments, so the functions read the component's
names through the namespace accessors — which means **Svelte discovers their
dependencies by itself**, exactly as it does for `@derived`.

So the template is Python, with no helpers:

```svelte
{value is None}              {a and not b}           {len(rows)}
{"yes" if flag else "no"}    {rows[1:]}              {f"{n} items"}
{item.label}                 {mapping["key"]}        {[x.upper() for x in xs]}
```

`{item.label}` on a class instance works — that was the wart `py.of()` used to
paper over. `{#if rows}` follows Python's truth, so an empty list is false. And a
`dict` has no attributes: `{d["k"]}`, not `{d.k}` — the semantics are Python's,
including where that differs from JavaScript.

Every site the markup *reads* goes through Python, not only interpolations:

```svelte
{#each scores.items() as [k, v]}   <!-- a dict, a range, a generator: not arrays -->
  {@const half = (v - 7) // 2}     <!-- -4, where JavaScript would say -3.5 -->
{/each}
{#key point}                       <!-- compared by repr(), Python's own equality -->
{@html render(row)}
```

The `{#each}` iterable is evaluated *outside* the block and the key inside it, so
each is compiled against the names it can actually see. A key and `{#key}` compare
by `repr()`: identity is what Svelte would use, and no Python value keeps one —
`(1, 2)` rebuilt is a different object.

**Directives keep the host language**, because they carry a callback or a
JavaScript value rather than a rendering:

```svelte
<input oninput={(e) => on_text(e.target.value)} bind:value={name} use:action />
```

The rule: `on*`, `bind:`, `use:`, `class:`, `style:` and the transition family
stay JavaScript; every other attribute, component prop included, is Python — and
so are the shorthand `{name}` and the spread `{...attrs}`, which are expanded so
that the read goes through the namespace rather than around it.

**The template language follows the script language, with no third mode.** A
component without `lang="python"` is a JavaScript component and stays one, even
when it imports a `.py` store: its `{value}` is Svelte's `{value}`, and a Python
list renders as JavaScript renders it. Nothing is injected behind an author's
back — exactly as TypeScript does not leak into a `.js` file. `py.str()`,
`py.truthy()` and `py.of()` remain exported from the runtime for a JavaScript
component that *wants* Python semantics and imports them on purpose.

It costs **1.3× to 1.7× on rendering** against a JavaScript component (`npm run
bench`, the spread being what a modest laptop measures from one day to the next),
against 0.6× before: one Python call per expression per render. That is the price
of the template being Python.

## Composition

A Python component has a single instance `<script>`. Children are therefore
imported in a `<script module>`, whose declarations stay visible to the markup:

```svelte
<script module>
    import Row from './Row.svelte';
</script>

<script lang="python">
rows = [Item("a", 1), Item("b", 2)]
</script>

{#each rows as r}<Row row={r} />{/each}
```

A Python object is passed as a prop with no conversion, and read back as
Python — attributes and descriptors included, since template expressions are
compiled as Python:

```svelte
{item.label}     <!-- attribute -->
{item.double}    <!-- @property, evaluated -->
```

## Derived values and bindings

`@derived` turns a function into a value — Python reads the name and gets the
result, exactly like a `@property`:

```python
first = "Ada"
last = "Lovelace"

@derived
def full():
    return f"{first} {last}"
```

`{full}` in markup, `full` in Python. The body runs inside `$derived.by`, and
every global it touches goes through a namespace accessor, so **Svelte discovers
the dependencies by itself** — nothing to declare. A `@derived` may read another.
It must be **pure**: writing state inside a derived is rejected by Svelte, and
rightly so.

`bind:` needs no support code at all: a state name is an ordinary reactive `let`,
so `bind:value={name}` works both ways and Python reads back what was typed.

`bindable()` on an annotation declares a two-way prop — the child may write to
it and the parent's own variable follows:

```python
value: str = bindable()          # no default
tag: str = bindable("default")   # with one
```

```svelte
<Child bind:value={text} />
```

The subtlety is in the default: the module body applies it by writing to the
name, and that write must not travel up to the parent. Only writes made after
`init()` returns are real ones.

## Reactivity: one signal per name

The namespace is **not** a `$state` proxy. Svelte would then deep-proxy every
Python value stored in it, and a proxied Brython object fails its own type checks
— `repr((1, 2))` raises *descriptor `__repr__` requires a 'tuple' object but
received a 'tuple'*. Instead every module-level name gets its own `$state.raw`,
published to Brython through an accessor: Python values stay opaque to Svelte.

Rebinding a name is reactive, and so is mutating a container in place:

```python
count += 1          # reactive — rebinds `count`
items = items + [x] # reactive — rebinds `items`
items.append(x)     # reactive — the object says so itself
table["k"] = v      # reactive
```

The second signal is how. Each name carries a value *and* a revision counter, and
the accessor reads both — so a reader depends on the revision too. A mutation
bumps only the counter: nothing is copied, and the object keeps its identity.

Detecting the mutation is the other half, and it is where Python pays off. Svelte
proxies the value in depth, which is unusable here — a proxied Brython object
fails its own type checks. But a Python list *is* a JavaScript array, so the
object itself can carry a non-enumerable marker: `$B.get_class` reads only
`ob_type`, so `type(items) is list` stays true and `repr` is untouched. Brython routes
every write through a handful of functions — method call, indexed write and read,
attribute write, `del` — so **seven dispatch points cover the whole language**, and
an unmarked object pays one property miss.

The marker travels with the object, which no compile-time analysis could match:

```python
def fill(target):
    target.append("x")   # the compiler sees nothing here

def add():
    fill(items)          # reactive all the same
```

Nesting comes for free from the same marker. Reading a container out of a watched
one puts it under the same watch — which is what deep proxying buys Svelte, done
lazily and without a single proxy: the child is marked the first time Python
reaches for it, which is necessarily just before it could be mutated.

```python
data = {"rows": []}
data["rows"].append(x)   # reactive: reading data["rows"] put it under watch
```

Measured on `$B.$getitem`, the hottest of them: **+4% on
`xs[i]`**, and +4% again when the marker actually travels.

Attributes work the same way — `$setattr`, `$setattr1` and `$delattr` — and
`{#each}` hands the watch down to its rows, so a row's block subscribes to the
row itself. Which closes the surprising case: in `{#each items as it (it.id)}`,
`it.label = "…"` re-renders the row **and** keeps its DOM node, since the key did
not move.

Where it stands, each line held by a test:

| | propagates |
|---|---|
| `items.append(x)`, `table[k] = v`, `del table[k]`, `tags.add(x)` | yes |
| `data["rows"].append(x)` — a nested container | yes |
| `box.value += 1`, `del box.extra` — an instance attribute | yes |
| `box.rows.append(x)` — a container held in an attribute, even one set in `__init__` | yes |
| `it.label = …` — an item of a keyed list | yes |
| a mutation made inside a helper the compiler cannot see | yes |
| through a `@derived` that hands back the object, or a component prop | yes |
| a child reached through `.items()`, `.values()` or `.get()` | yes |
| `<p {...attrs}>` — a spread | yes |
| `<p title={items}>` — an attribute carrying the container itself | no — **and neither does JavaScript** |

The last line is host semantics, not a limitation of ours: Svelte compares the
value against the one it last applied, by identity, inside its own DOM writer,
where no signal reaches — and a mutated container is the same object. An
idiomatic Svelte component with `$state` behaves exactly the same, which
`tests/parity.test.js` proves by running the same component in both languages,
line for line. Everything else propagates, and a test holds each line.

Accessors live on the namespace's **prototype**, never on the object itself:
rebinding a global emits `$B.delete_for_reassign(name, locals)`, and a `delete`
on an own accessor would drop it for good — silently unhooking the signal after
the very first write.

## Two kinds of `.py`, the way TypeScript has two kinds of `.ts`

Svelte already draws this line for TypeScript, and Python follows it unchanged:

| TypeScript | Python | compiles to |
|---|---|---|
| `helpers.ts` | `helpers.py` | an ordinary JavaScript module |
| `panier.svelte.ts` | `panier.svelte.py` | a reactive module — its names become signals |
| `+page.server.ts` | `+page.server.py` | an ordinary module, which is what a route module is |

Nothing here is our invention. A `.ts` becomes reactive only when it is named
`.svelte.ts`, and the marker is not part of the module's name — `panier.svelte.py`
is imported from Python as `import panier`.

**An ordinary module** is Python compiled to JavaScript, and nothing else. No
runes, no signals, no cost for reactivity it does not use. Its functions are its
exports; `__all__` says otherwise when you want it to:

```python
# peps.py
__all__ = ["chercher", "trouver"]

def chercher(requete=""):
    return [p for p in CATALOGUE if requete in p["titre"]]
```

`__all__` is Python's own way of saying what a module exports, and it is the
closest thing the language has to TypeScript's `export` keyword. JavaScript
imports those names directly:

```js
import { chercher } from '$lib/peps.py';
```

**A reactive module** is the shared-state one. Its module-level names become
signals created **once for the whole application**, where a component's state is
born and dies with each instance:

```python
# counter_store.svelte.py
count = 0
history = []

def increment():
    global count
    count += 1
    history.append(count)
```

```svelte
<script module>
    import { store } from './counter_store.svelte.py';
</script>

<p>{store.count} — {store.history}</p>
<button onclick={store.increment}>+</button>
```

Its runes are compiled by vite-plugin-svelte, whose module filter the project
widens to accept the extension — one setting, and the same shape the filter
already had for `.svelte.ts`:

```js
svelte({
    preprocess: [python()],
    experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } }
})
```

The filter is an infix — `.svelte.` — followed by one of those extensions, so
`panier.svelte.py` matches and `peps.py` does not: exactly the line the two kinds
draw. Names are exported through accessors: Svelte forbids exporting a reassigned
`$state` binding, and a getter is what keeps the read reactive at the call site
anyway.

The bridge runs both ways: a component's Python imports the module as an ordinary
Python module and reaches the same signals.

```python
import counter_store

def bump():
    counter_store.increment()
    return counter_store.count
```

`import counter_store` looks for `counter_store.svelte.py`, then `counter_store.py`,
in the importing file's own directory and then along `python({ path: [...] })` —
which plays the part of PYTHONPATH. The namespace is published in `$B.imported`
under its module name, and the importer's virtual module imports it first, so it
is registered by the time the body runs.

## Effects

`@effect` re-runs a function whenever a name it *read* has changed. Nothing to
declare: globals go through the namespace accessors, so their reads are signal
reads and Svelte works out the dependencies itself.

```python
count = 0

@effect
def watch():
    global seen
    seen = f"count={count}"

    def cleanup():
        ...
    return cleanup     # optional teardown, run before each re-run and on destroy
```

**The trap this model creates**: `runs += 1` on a module-level name *reads*
before it writes, so a counter incremented inside an effect makes the effect
depend on what it writes, and Svelte loops until
`effect_update_depth_exceeded`. A plain assignment reads nothing.

`$effect` belongs to a component, so a store — which has none — treats an
`@effect` function as an ordinary one.

## Lifecycle

By naming convention, backed by a single `$effect`:

```python
def on_mount():
    ...   # after the DOM exists

def on_destroy():
    ...   # on teardown, final state still readable
```

Both stay ordinary functions — Python may call them too. They run **untracked**:
a hook reads the component's names through the namespace accessors, and those
reads *are* signal reads. Without `untrack`, a `mounts += 1` inside `on_mount`
would make the effect depend on state it also writes, and Svelte loops until
`effect_update_depth_exceeded`. The teardown function is captured while the
component is alive: reading a signal from an already-destroyed teardown returns
nothing.

Each instance gets its own namespace — the Python module body re-runs on every
mount, mutable defaults included.

## Async

An `async def` handler runs. Two things had to be true for that: `async def` is a
distinct AST node, and missing it left async handlers **undefined** — a click did
nothing at all, silently. And calling one from JavaScript returns a coroutine
nobody runs, so the wrapper hands it to Brython's own event loop.

```python
from browser import aio

rows = []

async def load():
    global rows
    await aio.sleep(0)      # or aio.get(...) for a real request
    rows = ["…"]
```

An exception raised *inside* a coroutine surfaces through Brython's loop, not
through the wrapper, so it does not carry the file and line the synchronous path
adds.

## Context

`set_context` and `get_context` are injected into every component, like
`derived` and `effect`. Both must run while an instance initialises — which is
exactly when the Python module body runs, so nothing else was needed.

```python
# an ancestor
set_context("theme", "dark")

# any descendant, however deep
theme = get_context("theme")
```

Context is **per subtree**, where a store is per application: two instances of
the same component can carry different values, and the components in between
know nothing about it. A key that was never set reads as `None`, not
`undefined`.

That also makes it the one place to put state under per-request server
rendering: the component tree is rebuilt on every render, so nothing leaks
between requests — unlike a store, whose state lives in the module.

## Source maps

Brython scatters `$B.set_lineno(frame, N)` through the code it generates, so the
generated JavaScript carries the Python line each statement came from. That is
enough for a line-level source map, emitted with every virtual module: a
debugger opens the `.svelte` or `.py` file rather than a thousand lines of
generated JS.

Line-level, not column-level — one Python line maps to the run of generated
lines that implement it. A test decodes the map and checks a known statement
lands on its real line, because a map that points at the wrong place is worse
than no map at all.

## SvelteKit

A dependency, not a fork. SvelteKit delegates `.svelte` files to
vite-plugin-svelte, which applies the preprocessor declared in
`svelte.config.js`, and our Vite plugin sits alongside `sveltekit()`. One setting
is needed, and it is one SvelteKit already provides for exactly this:

```js
// vite.config.js — SvelteKit 3 configures everything from here
export default defineConfig({
    plugins: [
        svelthon(),
        vendorQuirks(),
        sveltekit({
            preprocess: [python({ path: ['src/lib'] })],

            // route modules may be Python
            moduleExtensions: ['.js', '.ts', '.py'],

            // and a reactive module is compiled like a `.svelte.ts`
            experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } }
        })
    ]
});
```

That makes the router see `.py` route modules. What then works, measured on a
production build with `adapter-node`, against **SvelteKit 3**:

| | |
|---|---|
| `+page.svelte`, `+layout.svelte`, `+error.svelte` | in Python, server-rendered then hydrated |
| `+page.server.py`, `+layout.server.py` | `load()` in Python, its data merged as usual |
| `async def load()` | awaited by the framework |
| streaming | a coroutine in the returned data becomes a promise SvelteKit streams |
| page options | `prerender`, `ssr`, `csr` — exported through `__all__` |
| cookies, `setHeaders` | through `event["js"]`, no bridge of ours involved |
| `handle`, `handleError` | in Python, behind a two-line JavaScript shim |
| `reroute`, client `handleError` | likewise — universal and client hooks |
| nested layouts | `+layout.server.py` at each level, data merged |
| `+page.py` | a universal `load()` — on the server, then in the browser on a client navigation |
| `+server.py` | a pure-Python endpoint, building its own `Response` |
| form actions | `actions = {"default": noter}`, with `await request.formData()` |
| `error()`, `redirect()`, `fail()` | called from Python |
| dynamic routes | `event["params"]["numero"]` |
| a `.py` imported from JavaScript | by its named exports |

Streaming falls out of the same rule. A coroutine handed to the framework
becomes a promise — and what it resolves to makes the same crossing:

```python
async def _lentes():
    await js.Promise.new(lambda ok, ko: js.setTimeout(ok, 400))
    return chercher("", "Final")[:5]

def load(event):
    return {"immediat": compter(), "lentes": _lentes()}   # streamed
```

Python awaits a JavaScript promise there, which works because Brython's own event
loop is what runs the coroutine. Only a **server** `load()` streams; a universal
one re-runs in the browser instead, which is SvelteKit's rule, not ours.

Page options work as they do anywhere, which has one consequence worth naming:

```python
__all__ = ["load", "csr"]

csr = False
```

That page ships **no JavaScript at all** — and therefore no Brython. A component
written in Python, delivered as bare HTML. With `prerender = True` instead, the
Python runs at build time and the page is a file on disk.

### The two bridges

Python cannot import from npm, and a plain `.py` has no `<script module>` to do
it for it. It declares what it needs the same way it declares what it exports —
an ordinary assignment, read from the AST:

```python
__js__ = {"@sveltejs/kit": ["error", "fail"]}
__all__ = ["load", "actions"]
```

For the platform itself, `js` is the JavaScript globals and `to_js()` converts a
Python container into something a Web API will accept:

```python
def GET(event):
    corps = js.JSON.stringify(to_js(chercher(event["query"].get("q", ""))))
    return js.Response.new(corps, to_js({"headers": {"content-type": "application/json"}}))
```

### The boundary converts, both ways

SvelteKit wraps `params` and `url` in proxies that record every key read, so it
knows what a `load()` depended on — and Brython probes an object's symbols as it
wraps it for Python, which lands symbols in that record and makes SvelteKit's
serialiser refuse it. Python therefore never touches the proxy: the boundary
reads it in JavaScript and hands over a Python dict.

```python
def load(event):
    numero = event["params"]["numero"]
    requete = event["query"].get("q", "")

    if not (fiche := trouver(numero)):
        error(404, "rien sous ce numéro")     # SvelteKit 2 throws it itself

    return {"pep": fiche}                     # a dict, converted on the way out
```

`event` carries `params`, `query`, `url`, `method`, `route`, and `js` — the raw
event. That last one is the escape hatch, and it is enough on its own:

```python
biscuits = event["js"].cookies
theme = str(biscuits.get("theme") or "clair")
biscuits.set("theme", "sombre", to_js({"path": "/"}))
event["js"].setHeaders(to_js({"x-svelthon": "bonjour"}))
```

The same treatment reaches inside an exported **dict of functions**, which is
what `actions` is: each one gets its arguments converted, its coroutine awaited
and its result converted back. What is *not* a Python container — a `Response`,
a `Promise`, an `ActionFailure` — is passed through untouched.

### The one place SvelteKit is hard-coded

Hooks are found by `resolve_entry`, which matches `/\.(js|ts)$/` and ignores
`moduleExtensions` — so `src/hooks.server.py` is never seen. A two-line shim
bridges it, and everything else stays Python:

```js
// src/hooks.server.js
export { handle, handleError } from './hooks.server.py';
```

```python
async def handle(entree):
    reponse = await entree.resolve(entree.event)
    reponse.headers.set("x-python-handle", "1")
    return reponse
```

Param matchers are the exception: SvelteKit imports `src/params` with Node's own
loader rather than through Vite, so a shim re-exporting from a `.py` fails with
`ERR_UNKNOWN_FILE_EXTENSION`. They stay JavaScript — one file, a few lines.

## Server-side rendering

It works. Svelte compiles a second version of each component that returns an
HTML string instead of creating DOM nodes, so the Python body runs under Node —
which is what the compiler already does at build time. Two shims were missing
from the browser runtime (`self`, `addEventListener`); `src/lib/globals.js` now
sets them, and that was the whole obstacle.

Covered by `tests/ssr.test.js`: components, props, composition with child
components and attribute access, and the Python values themselves — `-7 // 2`
still
renders `-4` server-side.

**The one real trap, and it is not specific to SVELTHON.** A store's state lives
in the module, so it is shared by every request the process serves. Svelte warns
about exactly this for module-level `$state` in a `.svelte.js`. Harmless when
**prerendering** — one pass, no concurrent users — and a data leak under
per-request rendering. Svelte's answer is context, which SVELTHON does not
expose to Python yet, so the two gaps compound: per-request SSR needs context
first.

Prerendering is therefore the reachable target: it needs no server, it fits the
build chain that already runs Brython under Node, and it is what a documentation
or demo site actually wants.

## Errors

A Brython exception reaches JavaScript **with no `message` and no `stack`**:
devtools and Vite's overlay show nothing at all, while the text sits in the
Python object. Every handler and the module body are therefore wrapped to fill
them in, naming the function and the file:

```
ValueError: broke deep down (boom() — src/Counter.svelte:6)
```

The line comes from the Python traceback, offset back to the file's own
numbering — a `<script module>` placed before the Python does not skew it. A
Python **syntax error** at build time is reported the same way, rather than as an
empty object Vite cannot describe.

The component survives the exception — the next handler still works — and a
Python `try/except` stays a Python `try/except`: the wrapper only applies to what
reaches JavaScript.

## HMR

A component's generated code lives in a virtual module — a separate entry in
Vite's graph, tied to nothing. Without explicit invalidation, editing the Python
re-transforms the component while still serving **the previous generated body**:
the page updates to code that never changed. The plugin's `hotUpdate` hook
invalidates the component's virtual modules, and `npm run test:hmr` checks both
paths.

A store goes through a different path — `load()` rather than the preprocessor —
and had the same illness, worse: its own `.svelte.js` module has to be
invalidated too, or its `load()` never re-runs and the cache keeps the old body.

## Stdlib: only what you import

`py2js()` exposes a component's imports, and Brython's VFS already carries the
dependency graph (`[ext, source, deps, is_package]`). The transitive closure is
therefore exact, and only it enters the bundle:

| | |
|---|---|
| `import sys` → modules bundled | `sys`, `browser` |
| bundled weight | **7.2 KB** |
| full stdlib | 4.6 MB |
| | **652× smaller** |

`vendor/brython_stdlib.js` is the build-time source and is never shipped.

## Svelte surface covered

Measured, not assumed (`tests/svelte-surface.test.js`) — all of this works inside
a Python component:

| | |
|---|---|
| blocks | `{#if}` `{:else if}` `{#each}` (indexed, `{:else}`, keyed) `{#key}` `{#await}` |
| tags | `{@html}` `{@const}` `{@render}` `{#snippet}` |
| bindings | `bind:value` `bind:checked` `bind:group` `bind:this` |
| directives | `class:` `style:` `use:` `transition:` |
| composition | props, defaults, spread of a **Python dict**, children as snippets |
| elements | `<svelte:window>` `<svelte:head>` `<svelte:boundary>` |
| styles | scoped `<style>` |

Template expressions are Python throughout, including the corners that are not
interpolations: the iterable of an `{#each}`, its key, `{#key}`, the right-hand
side of an `{@const}`, `{@html}`, the shorthand `{name}`, the spread `{...attrs}`,
and an interpolation inside a quoted attribute — `class="tag {statut.lower()}"`.

Two Python spellings are accepted where Svelte has its own: `{#each d.items() as
(k, v)}` destructures a tuple, and `{#each xs as x, i}` keeps Svelte's meaning of
item and index. What a component imports or declares in its `<script module>` is
readable from Python too, which is how a Python component reaches a JavaScript
library at all.

## Status

Validated by `npm test` — 137 tests, plus 3 expected failures (below):

- end-to-end reactivity, and which write paths propagate;
- props: Python defaults, parent precedence, readability during init, parent
  updates flowing through to Python;
- **semantic fidelity grid**: integers, text, protocols, control flow, frames.
  Every expected value was produced by running the component's Python through
  CPython 3.12 as-is, never written by hand. Brython matches CPython on **39 of
  40 points**;
- production build: **250 KB gzip**, Brython runtime included.

The grid doubles as an acceptance bench for optimising code generators: one that
drops call frames breaks `Frames`, one that unboxes integers breaks `Integers`,
one that short-circuits `augm_assign` breaks `Protocols`.

### Known divergences

Three, each flagged by a `test.fails` that will speak up the day it changes. Two
are Brython's: a comprehension's variable **leaks into the enclosing scope**
(`[q for q in range(3)]` leaves `q` defined), at module level and inside a
function alike. The third is Svelte's, and it is not a bug: a `$derived` that
hands back the object it was given compares equal to itself, so nothing
propagates from it — which is why a reader subscribes to the object rather than
to the derived (see [Reactivity](#reactivity-one-signal-per-name)).

## Testing

No parallelism. Each worker reloads and re-transforms the Brython runtime for
itself instead of sharing the work: measured on this project at over 30 minutes
in parallel against under one sequentially.

## Editor support

Not a gap in SVELTHON, but worth knowing: the Svelte TextMate grammar falls back
to **JavaScript** for an unrecognised `lang`, so `<script lang="python">` is not
left uncoloured — it is coloured wrongly, `#` comments included.

The grammar already lists `coffee` beside `ts`, so adding `python` upstream in
`svelte-language-tools` follows an existing precedent. A grammar injection
shipped as a small editor extension is the other route.

### Hydration

Svelte's own runner drives every sample in three modes — client, server,
**hydrate** — and the third is where the two halves have to agree, since the
Python body runs on both sides. Covered by `tests/hydration.test.js`:

- the server's nodes are **reused, not rebuilt** — node identity survives, which
  is the proof hydration actually happened;
- Python is wired to those reused nodes: a click still increments;
- **on a mismatch the client value wins, silently.** No warning. A
  non-deterministic component — reading the clock, a random, a session — will not
  crash; it will paint one value and then flip to another.

The exact server output, hydration markers included, is asserted in
`tests/ssr.test.js`, so the two files cannot drift apart.

## What it costs at runtime

Measured with `npm run bench`: the same component written twice, once in Python
and once in JavaScript, driven through real clicks in a headless Chromium. Click
dispatch costs the same on both sides, so the gap between the columns belongs to
the handler. Seven alternating rounds, the minimum kept — the least polluted
measurement, not the average of the machine's interruptions.

| | Python | JS | gap |
|---|---:|---:|---:|
| warm mount | 0.3 ms | 0.2 ms | ~1.5× |
| 2000 handler calls | 28 ms | 18 ms | **~1.5×** |
| 1500 × sum of 500 squares | 1128 ms | 15 ms | **50–100×** |
| rendering a 500-row keyed list | 5.0 ms | 8.0 ms | **0.6×** |

Three things to take from it.

**Calling into Python is cheap** — about 1.5× a JS handler. Frames and
`augm_assign` cost something, but nothing that a click will ever notice.

**Python computation is one to two orders of magnitude slower.** The ratio swings
between 50× and 100× across runs, which is the honest range on a modest laptop.
Keep hot loops out of a component, or reach for the C extensions
[Wasthon](https://github.com/fgallaire/wasthon) compiles to WebAssembly.

**Rendering is not slower — it is faster.** Consistently, across every run. Svelte
deep-proxies the objects inside a `$state` array; SVELTHON's names are
`$state.raw`, so Python values are never proxied. The reactivity design pays for
itself exactly where a real application spends its time.

Loading is the real price: **1.2 s to interactive** for the production demo on
this laptop, against 0.5 s for the same page without Brython — 250 KB gzip
instead of 13 KB. Paid once per session, not per page, since the app never
reloads.

## Not done yet

**Blocks a real application**

- **Packaging.** `src/lib/` is the framework, mixed in with the demo. Using it
  anywhere else means turning it into an installable npm package. Nothing
  technical stands in the way — it is the one item on this list that is pure
  work. The SvelteKit spike already showed the shape it has to take: the
  preprocessor and the plugin must share their registry through
  `globalThis`, because SvelteKit loads `svelte.config.js` and Vite loads
  `vite.config.js` through different loaders, and this file is then evaluated
  twice.

**Worth deciding**

- **Django template syntax.** `{% if %}` / `{% for %}` over the Svelte blocks,
  for the audience that has it in their fingers. Written and unwired in
  `src/lib/dtl.js`; the decision is one of positioning, not of technique.


**Upstream, in Brython**

Both bugs, the internals SVELTHON depends on, and the error messages that cost
the most debugging time are written up in **[BRYTHON.md](BRYTHON.md)** — the
contract between the two projects, with a minimal reproduction for each.

- **Flattened `__file__`.** The namespace identifier comes from `filename` and
  only `.` is neutralised, so a real path yields `locals_src/Counter_svelte` —
  invalid JavaScript. A flattened name is passed instead, at the cost of
  traceback readability.
- **Comprehension leak.** The loop variable escapes its scope, in a function as
  well as at module level.

## Running

```sh
npm install
npm test             # fidelity grid, props, reactivity (jsdom)
npm run test:browser # DOM interop and the demo, in a real Chromium
npm run test:hmr     # virtual-module invalidation
npm run dev          # demo page
npm run build
```

### Two non-obvious settings in `vite.config.js`

`optimizeDeps.entries: []` — Vite's dependency scanner runs **ahead** of the
plugin pipeline: it reads the HTML entries, hits `<script lang="python">` and
hands the Python to a JavaScript parser, then fails on `./store.py`, which no
file of that name is meant to serve. Its only job here is to discover bare
imports, so the scan is skipped and the one package worth pre-bundling is named.

`vendorQuirks()` — Brython loads JS modules named from Python through an
`import()` whose argument is a variable. Vite cannot analyse it and says so on
every start; the plugin marks those calls with `@vite-ignore` on the fly, which
leaves the vendored file byte-identical to upstream.

`vendor/brython.js` is a copy of `www/src/brython.js` (3.14 dev). The folder
carries a `package.json` marked `commonjs`: Node must load it as a classic
script, while the root is `type: module`.

## The wider stack

SVELTHON stands on its own — a Python frontend framework, nothing more required.
But because it runs on Brython rather than a sandboxed interpreter, everything
built for Brython is available to a component: notably
[Wasthon](https://github.com/fgallaire/wasthon), which brings CPython's real C
extension modules to the browser as WebAssembly, and
[NumBry](https://github.com/fgallaire/numbry), which builds the scientific stack
— NumPy, pandas, SciPy, matplotlib, Pillow, SymPy — on top of it.

That matters for how much you ship. Where a full CPython-in-WebAssembly runtime
arrives as one large payload, these are per-module `.wasm` files, and SVELTHON
already knows exactly which modules a component imports — the same tree-shaking
that trims the standard library applies to them.
