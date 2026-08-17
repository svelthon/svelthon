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
npm test             # 92 tests: semantics, props, reactivity, Svelte surface
npm run test:browser # DOM interop and the demo, in a real headless Chromium
npm run test:hmr     # virtual-module invalidation, component and store paths
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

## Templates are JavaScript

The rule to remember: inside markup you are in JS, not Python. Two consequences,
one of them fixed automatically.

`{#if}` is **rewritten** to Python's `bool()` by the preprocessor — otherwise an
empty list, an empty dict or `None` would all read as true, since JS holds every
object truthy. `{#each}` needs nothing: a Brython list *is* a JS array.

**Text interpolation** is wrapped in `py.str()`, or a list would render as
`a,b,c` and a dict as `[object Object]` — and since a Brython list is literally a
JS array, no prototype could have been patched instead.

```svelte
{#if items}   <!-- rewritten to py.truthy(items) -->
  {items}     <!-- rewritten to py.str(items) → ['a', 'b', 'c'] -->
{/if}
```

**Attribute values and component props are left alone**: they carry the value,
not its rendering. `data-v={items}` receives the list itself. The rewrites touch
markup only, never a `<script>` or `<style>` — Python is full of braces.

For events, the recommended shape is to extract in the template and compute in
Python:

```svelte
<input oninput={(e) => on_text(e.target.value)} />
```

Walking the DOM from Python works too, one line away: a node's class is resolved
through `$B.imported['browser.html']`, which only a real import registers.

```python
from browser import html, document

el = document.createElement("input")   # → INPUT
```

It cannot be pre-imported at boot (`$B.$import` reads `$B.frame_obj`, null until
a module body has run), and injecting it into every component with a
parameterised handler would cost a class per HTML tag to components that never
touch a node.

**jsdom hangs on that import** while a real browser does not — hence
`npm run test:browser`, which replays the check in headless Chromium. It is the
one part of the project the jsdom suite cannot cover.

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

A Python object is passed as a prop with no conversion. In markup, dicts and
tuples read directly — a Brython dict's keys are exposed as JS properties, a
tuple *is* an array. **Class instances** are the exception: Brython keeps their
attributes out of the JS properties, so `{o.label}` would render empty.
`py.of()` goes through Python's own attribute lookup, descriptor protocol
included:

```svelte
{py.of(item).label}    <!-- attribute -->
{py.of(item).double}   <!-- @property, evaluated -->
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

The consequence worth knowing: **rebinding a name is reactive, mutating a value
in place is not.**

```python
count += 1          # reactive — rebinds `count`
items = items + [x] # reactive — rebinds `items`
items.append(x)     # NOT reactive — mutates without rebinding
box.value += 1      # NOT reactive — mutates an attribute
```

To mutate in place without giving up `{#each items}`, `publish(name)` is injected
into every component. It hands the template a fresh identity — a shallow copy for
a list, a dict or a set — which is enough to clear Svelte's `===` check:

```python
def add():
    items.append(len(items))
    publish("items")
```

A component that defines its own `publish` keeps it.

The same rule holds at three levels, and it is the only one to remember —
**rebind, don't mutate**:

| level | does not propagate | propagates |
|---|---|---|
| name | — | `count += 1` |
| collection | `items.append(x)` | `items.append(x)` + `publish("items")` |
| item of a keyed list | `it.label = …` | `items[i] = Item(it.id, …)` |

The third case surprises: in `{#each items as it (py.of(it).id)}`, mutating an
item's attribute re-renders nothing even after `publish()`, because the item kept
its identity. Replacing it updates the render **and** still reuses the DOM node,
since the key did not move.

Accessors live on the namespace's **prototype**, never on the object itself:
rebinding a global emits `$B.delete_for_reassign(name, locals)`, and a `delete`
on an own accessor would drop it for good — silently unhooking the signal after
the very first write.

## Shared state: a plain `.py` file

The Python equivalent of a `.svelte.ts`. The file is ordinary Python; its
module-level names become signals created **once for the whole application**,
where a component's state is born and dies with each instance.

```python
# counter_store.py
count = 0
history = []

def increment():
    global count
    count += 1
    history.append(count)
    publish("history")
```

```svelte
<script module>
    import { store } from './counter_store.py';
</script>

<p>{store.count} — {store.history}</p>
<button onclick={store.increment}>+</button>
```

The store is served under a `.svelte.js` identity, which is precisely what makes
vite-plugin-svelte compile the runes inside it. Names are exported through
accessors: Svelte forbids exporting a reassigned `$state` binding, and a getter
is what keeps the read reactive at the call site anyway.

A component that only *consumes* a store, with no Python of its own, still gets
the markup rewrites and `py` in scope — otherwise `{store.history}` would fall
back to JavaScript rendering.

The bridge runs both ways: a component's Python imports the store as an ordinary
Python module and reaches the same signals.

```python
import counter_store

def bump():
    counter_store.increment()
    return counter_store.count
```

The store's namespace is published in `$B.imported` under its module name, and
the component's virtual module imports the store first, so it is registered by
the time the component body runs.

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
`publish` and `derived`. Both must run while an instance initialises — which is
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

## Server-side rendering

It works. Svelte compiles a second version of each component that returns an
HTML string instead of creating DOM nodes, so the Python body runs under Node —
which is what the compiler already does at build time. Two shims were missing
from the browser runtime (`self`, `addEventListener`); `src/lib/globals.js` now
sets them, and that was the whole obstacle.

Covered by `src/ssr.test.js`: components, props, composition with child
components and `py.of()`, and the Python values themselves — `-7 // 2` still
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

Measured, not assumed (`src/svelte-surface.test.js`) — all of this works inside
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

Reminder: **template expressions are JavaScript.** `{node is not None}` does not
compile; write `{py.truthy(node)}`.

## Status

Validated by `npm test` — 92 tests, plus 1 expected failure (below):

- end-to-end reactivity, and which write paths propagate;
- props: Python defaults, parent precedence, readability during init, parent
  updates flowing through to Python;
- **semantic fidelity grid**: integers, text, protocols, control flow, frames.
  Every expected value was produced by running the component's Python through
  CPython 3.12 as-is, never written by hand. Brython matches CPython on **39 of
  40 points**;
- production build: **244 KB gzip**, Brython runtime included.

The grid doubles as an acceptance bench for optimising code generators: one that
drops call frames breaks `Frames`, one that unboxes integers breaks `Integers`,
one that short-circuits `augm_assign` breaks `Protocols`.

### Known divergence

One, flagged by a `test.fails` that will speak up the day it is fixed: a
comprehension's variable **leaks into module scope** (`[q for q in range(3)]`
leaves `q` defined), where Python 3 gives it a scope of its own.

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

## Not done yet

**Blocks a real application**

- **Packaging.** `src/lib/` is the framework, mixed in with the demo. Using it
  anywhere else means turning it into an installable npm package. Nothing
  technical stands in the way — it is the one item on this list that is pure
  work.


**Rough edges**

- **Runtime cost** never measured against plain Svelte.

**Upstream, in Brython**

- **Flattened `__file__`.** Brython derives its namespace identifier from
  `filename` and neutralises only `.`, not `/`: a real path yields
  `locals_src/Counter_svelte`, which is invalid JS. A flattened name is passed
  instead, at the cost of traceback readability.
- **Comprehension leak**, the known divergence above.

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
