<img src="img/svelthon-512.png" alt="Svelthon" width="128">

# Svelthon

**Svelte components in Python.**

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

That is the whole thing. Plain Python: no runes, no reactivity API to learn,
no decorators around your state. The browser receives only JavaScript: unlike
every other Python-in-the-browser approach, nothing is transcompiled while the
page loads.

*[Version française](README.fr.md).*

## Why

Python is the most used language in the world, and running it in a browser has
been promised many times, by Brython, Skulpt, Transcrypt and PyScript. The barrier
was never the language. It was the workflow: no components, no props, no hot
reload, a compiler shipped to every visitor, and a page that spent its first
second compiling.

Svelthon keeps the modern frontend chain intact. Components, props, scoped
styles, keyed lists, HMR, tree-shaking, all of it, with Python as the
component language and **no runtime penalty at load**, because the compilation
already happened.

## Quick start

```sh
npm install svelthon
```

Two names, in a project that already has Svelte 5 or SvelteKit: a Vite plugin,
and a preprocessor for `svelte.config.js`. Node `^20.19.0 || >=22.12.0`, Vite
7's range: the plugin `require`s an ES module, which Node does without a flag
from those versions only, and Node 21 or 22.0 to 22.11 would raise
`ERR_REQUIRE_ESM`.

```js
// vite.config.js
import { svelthon, python } from 'svelthon';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        svelthon(),
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

Write `<script lang="python">` and that is it. [SvelteKit](#sveltekit) has the
rest of that configuration and what each line buys.

### Working on Svelthon itself

```sh
npm install
npm run dev          # the demo, at /demo/

npm test             # semantics, props, reactivity, Svelte surface, then the browser check
npm run test:quiet   # the suite's own output: a green run must say nothing
npm run test:browser # the browser check alone: DOM interop, the markup pass and the demo, in a real headless Chromium
npm run test:hmr     # virtual-module invalidation, component and store paths
npm run test:kit     # a SvelteKit app built with adapter-node: routes, remote function
npm run test:all     # all of the above, in order, stopping at the first failure
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
assignment Brython's code generator already emits becomes a reactive write,
without rewriting a line of generated code.

The hijack is by name: a module body may import others while it runs, and each
import creates its namespace through the same function. The expected pattern is
only *checked* at compile time: if a future code generator stopped emitting it,
the build fails loudly instead of shipping a component with no reactivity.

## The API, and what it replaces

Twenty-one names, and nothing to import: they are injected into the module's
namespace. Each one stands where a rune stands in JavaScript.

Two rules govern them. The **helpers** step aside when a component defines its
own name of that spelling, exactly as a Python module defining `list` shadows the
builtin. The six that are Svelthon's own words (`derived`, `effect`,
`bindable`, `export`, `inspect`, `inspect_with`) are **refused**: redefining
`effect` is closer to redefining `def` than to shadowing `list`, and Svelte draws
the same line by reserving the `$` prefix. The refusal happens at compile time
and names the culprit.

A third list belongs to JavaScript rather than to us. A module-level name it
reserves (`default`, `new`, `static`, `enum`, `interface`, `case` and the rest)
cannot be given a binding in the generated module, so it is refused at its line
with the rename Python has for the collision: `new_`. Inside a `def` the same
word is an ordinary local and nothing objects.

A fourth is the compiler's own: a name that starts with `__` and does not end
with one (`__cache`, not `__all__`) is refused wherever it is declared, in the
script and in the markup alike, because the generated code builds its names out
of that prefix in the same scope.

| Python | Svelte 5 |
|---|---|
| `count = 0` | `let count = $state(0)` |
| `name: str` | `let { name } = $props()` |
| `size: int = 3` | `let { size = 3 } = $props()` |
| `value: str <=>` | `let { value = $bindable() } = $props()` |
| `value: str = bindable()` | `let { value = $bindable() } = $props()` |
| `doubled => count * 2` | `let doubled = $derived(count * 2)` |
| `@derived` on a `def` | `$derived.by(…)` |
| `=> js.console.log(count)` | `$effect(() => console.log(count))` |
| `@effect` | `$effect(…)` |
| `@effect.pre` | `$effect.pre(…)` |
| `@effect.root` | `$effect.root(…)` |
| `def on_mount()` / `on_destroy()` | `onMount()` / `onDestroy()` |
| `set_context(k, v)` / `get_context(k)` | `setContext(k, v)` / `getContext(k)` |
| `props_id()` | `$props.id()` |
| `host()` | `$host()` |
| `inspect(*values)` | `$inspect(…)` |
| `inspect_with(fn, *values)` | `$inspect(…).with(fn)` |
| `@export` on a `def` | `export function …`, what a parent reaches through `bind:this` |
| `f = export(lambda: …)` | `export const f = () => …`, the same in one line |
| `to_js(value)` | *none*, a Python container made readable from JavaScript |
| `to_py(value)` | *none*, the other way: a JavaScript value read as Python |
| `tojson(value, indent=None)` | *none*, `to_js` with the dump attached, under Jinja's own word |
| `from_json(text)` | *none*, `to_py` with the parse attached |
| `batch(xs, n, fill)` | *none*, a flat list grouped into rows of `n`, the last padded with `fill`, as Jinja's `\|batch` |
| `date(value, style)` | *none*, a date read in the visitor's language, as Django's `\|date` |
| `fromnow(value)` | *none*, "3 days ago" or "in 2 hours", kept right as time passes |
| `slugify(text)` | *none*, a title made into a URL segment, as Django's `\|slugify` |
| `striptags(html)` | *none*, HTML shown as text, parsed rather than pattern-matched |
| `urlencode(value)` | *none*, a value, a mapping or a list of pairs, encoded into a URL |
| `js` | *none*, the JavaScript globals: `js.Response`, `js.JSON`, `js.URL` |
| `items.append(x)` | `items.push(x)`, since `$state` proxies deeply |

The last row is the one that costs work rather than a rename. See
[Reactivity](#reactivity-one-signal-per-name) for how an in-place mutation is
caught without a proxy.

There is no `$state` equivalent to write, because there is nothing to declare: a
module-level assignment already *is* the declaration, and the compiler reads it
from the AST.

**And that is the whole rule: a rune lives at the top level of the script, and in
the markup. Those are the two places the compiler reads a declaration.** In the
script it reads the AST and never descends into a `def` or a `class`, so a rune
written deeper would be built and wired to nothing; and a rune under an `if`, a
loop, a `try` or a `with` would be wired whether the block ran or not. Both are
refused instead, naming the line:

```
svelthon — a rune belongs at the top level of the module,
           and `@effect` is only read there (src/App.svelte:12)
```

Svelte's own rule is different, and it can be: `$effect` is a real call that
reads the current owner at run time, so where it is written does not matter to
them, only when it runs, which is why theirs refuses too, with `effect_orphan`,
once the owner is gone.

### The six runes with no counterpart, and why

Svelte documents seventeen rune forms. Eleven are in the table above, along with
`$inspect(…).with(fn)`, which is a method on what `$inspect` hands back rather
than a rune of its own. Six are absent on purpose, and the reasons differ.

| Svelte | why not |
|---|---|
| `$state.raw` | Nothing to opt out of in Python: a name is never a proxy, so every module-level name here is already raw, and a port would be a no-op wearing a name. A value crossing to JavaScript is its view, a proxy as a `$state` is, and `to_js(value)` is the opt-out there. |
| `$state.snapshot` | `to_js(value)`, a copy of what JavaScript otherwise reads through the view: for an API that clones, a library that sets fields of its own on the array it is given, or a large set of data read over and over. |
| `$state.eager` | Serves `await` expressions, which Svelte itself gates behind `experimental.async` and calls experimental. Nothing to mirror until that lands. |
| `$effect.pending` | as above |
| `$effect.tracking` | Tells a *library* author whether the code sits in a tracking context. Deferred: none of the 88 examples on svelte.dev uses any `$effect` variant, and four use `$effect` plain. |
| `$inspect.trace` | Names what caused an effect to re-run. Deferred with `$effect.tracking`, and for the same reason. |

Two of the six would do nothing, two wait on a feature Svelte has not settled,
and two are development tools. None is an oversight, and each is measured rather
than assumed.

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
prefix on any declaration inside a component**, in every scope, and Brython's
code generator opens with `var $B = __BRYTHON__`. An IIFE is not enough; it takes
a file Svelte never parses.

## Props: the annotation is the interface

Like a dataclass: annotated is public, assigned is internal.

```python
name: str              # required prop
punct: str = "!"       # prop with a default
greeting = "Hello"     # internal state, invisible to the parent
```

A prop is readable while the module body runs, a parent update flows through to
Python, and a required prop that was not passed reads as `None`, not
`undefined`. Writing to a prop from Python overrides it until the parent passes
a new value, which is Svelte's own rule for non-`$bindable` props.

A Python parent hands a Python child the value itself, a `float` subclass with
its class, and a JavaScript child JavaScript's number or string. None is the
absence to both, the `undefined` a Svelte parent passes, so the child reads its
default; `javascript.NULL` is a value, as `null` is. The compiler
tells the two apart by reading the child's file when the import names one. Any
other child, from a package, a path alias, a module that re-exports it or a
namespace, under a name the script assigned, `Picked = Child if wide else
Native`, a prop, a template name or `<svelte:component this={…}>`, is told
apart when its module loads: a child written in Python says so itself.

### A prop that travels back up

Props go one way, from parent to child, and that is what keeps a data flow
readable. `<=>` is how a component says it accepts to write back:

```python
value: str <=>              # bindable, no fallback
tag: str <=> "default"      # bindable, with one
```

```svelte
<Field bind:value={text} />  <!-- bound: what the child writes reaches text -->
<Field />                    <!-- not bound: an ordinary prop -->
```

Both sides consent: the child declares that it may be bound, the parent decides
whether to bind. Without `bind:`, a write inside the child stays there.

It is the fourth of the dialect's bindings, and they are one system built around
the same sign: `=` a name to a value, `=>` a name to an expression, `:=` a name
bound from inside an expression, `<=>` a name that travels both ways. The
nameless arrow, `=> expr`, is not one of them: with nothing to bind, it is an
effect. `bindable()` still works and means exactly the same thing.

Reading a global goes through `$B.resolve_global`, which demands an *own*
property unless the namespace carries the `$proxy` flag, in which case it reads
the property normally and therefore walks the prototype chain. It is the only
place in Brython that consults that flag, and it is what makes the prototype
trick compatible with props.

### An id that is unique to the instance

`props_id()` returns an identifier no other instance of the component shares,
and which is the same on the server and in the browser, so hydration finds what
the server wrote.

```python
uid = props_id()
```

```svelte
<label for="{uid}-firstname">First name</label>
<input id="{uid}-firstname" type="text" />
```

Without it, a component mounted twice writes `id="firstname"` twice: the second
label points at the first field, so clicking it focuses the wrong input and a
screen reader announces the wrong name. The same applies to `aria-labelledby`
and `aria-describedby`.

## Indentation, which is the one thing a `<script>` changes

In a Svelte component the script body is usually indented one level inside its
tag, because that is what the surrounding markup invites. In JavaScript that is
whitespace. In Python it is syntax, and an indented block is an error.

So Svelthon unindents the block for you, and **both of these compile**:

```svelte
<script lang="python">
count = 0
</script>

<script lang="python">
    count = 0
</script>
```

It is Brython's own `unindent`, the function it already runs on every
`<script type="text/python">`, rather than a rule of ours, so the two tags
behave the same way. Whitespace is removed, never a line, so error messages and
source maps keep pointing at the line you wrote.

Two cases it deliberately does not rescue, both because guessing would be worse
than failing:

- **a block that is only partly indented.** One non-blank line already at column
  zero and the source is left exactly as written, including the common case of a
  triple-quoted string whose content starts at the margin.
- **a `.py` file.** A file is not an embedded block; an indented one is a
  mistake, not a convenience.

In both, Python raises `IndentationError`, and be warned that Brython reports
it at the line *after* the last one rather than at the offending line, which is
a bug of theirs.

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
names through the namespace accessors, which means **Svelte discovers their
dependencies by itself**, exactly as it does for `@derived`.

So the template is Python, with no helpers:

```svelte
{value is None}              {a and not b}           {len(rows)}
{"yes" if flag else "no"}    {rows[1:]}              {f"{n} items"}
{item.label}                 {mapping["key"]}        {[x.upper() for x in xs]}
```

`{item.label}` on a class instance works, and `{#if rows}` follows Python's
truth, so an empty list is false.

Every site the markup *reads* goes through Python, not only interpolations:

```svelte
{#each scores.items() as [k, v]}   <!-- a dict, a range, a generator: not arrays -->
  {half => (v - 7) // 2}           <!-- -4, where JavaScript would say -3.5 -->
{/each}
{#key point}                       <!-- a tuple by value, a list or a row by identity -->
{@html render(row)}
```

The `{#each}` iterable is evaluated *outside* the block and the key inside it, so
each is compiled against the names it can actually see. None walks nothing and
shows the `{:else}`, as Svelte does with `null`: a list not handed over yet is
no rows, where Python's `for` would raise.

**Directives take Python as well.** A handler is a `lambda`, `class:` is read for
Python's truthiness, and so are `bind:checked`, `bind:indeterminate`,
`bind:open`, `bind:muted` and `bind:paused` on an element, None staying the
absence from which Svelte reads the element; a binding names something Python
can assign to:

```svelte
<input oninput={lambda e: on_text(e.target.value)} bind:value={row["label"]} use:action={opts} />
```

The rule: everything in a template is Python, every attribute, component prop
included, every directive's value, and the shorthand `{name}` and the spread
`{**attrs}`, which are expanded so that the read goes through the namespace
rather than around it, with no exception left. The spread takes what Python's
`{**attrs}` takes, a mapping's entries, and one thing more: an instance, which
Python refuses, gives its attributes, as `vars()` reads them. None spreads
nothing, as Svelte spreads nothing of `null`, so `extra: dict = None` is an
optional prop handed on. Any other Python value, a str or an int among them,
raises Python's `TypeError`; a JavaScript object spreads its own properties, as
in JavaScript.

`bind:group` was the last one, and it took a different shape rather than a pair:
Svelte will not accept a getter and a setter there, because it works out which
inputs form one group from the *text* of the expression. So it compiles to an
action, and the group stops needing an identity: each input computes its own
`checked` from the same target. Which is also what makes it work on a dict field,
on an object's attribute, and once per row of an `{#each}`, none of which
Svelte's own version manages here.

A checkbox group's list is **the checked inputs in document order**, which is
what Svelte's own binding collects, not the order they were clicked in.

### The two things to know

A template reads as Python and means what Python means, with two deliberate
exceptions. Both exist so that the everyday line stays one line, and both are
worth knowing before writing a component.

*(The script has its own: `importjs`, `=>`, the arrow being a derived when it
names and an effect when it does not, and `<=>`. All of them are gathered at the
end of this section.)*

**The dot finds a key.** `{row.label}` reads a dict as well as an object, exactly
as Jinja's dot does, so the shape of your data stops dictating the shape of your
markup, and a dict from an API renders like a dataclass:

```svelte
{pep.title}                        <!-- a dict or an instance, the same line -->
<input bind:value={row.label} />   <!-- and a binding writes back to the key -->
```

A real attribute still wins over a key of the same name, and a name that is
neither raises rather than rendering nothing. In the `<script>` the same text is
plain Python and raises: this is a template rule, not a language change. It
follows the text: a function of the script keeps plain Python when the markup
calls it, and a lambda written in the markup keeps the rule when it runs later,
as an event handler.

**A name nothing bound is absent, not an error, while the template renders.**
A module name assigned in a branch that did not run, or deleted, reads as
`None` in the markup, as JavaScript's `undefined` becomes `None` wherever it
enters Python: `{total}` renders nothing, `{f"[{total}]"}` renders `[None]`, and
`{total + 1}` raises Python's `TypeError` at its line. Python code reads it as
Python does, `NameError`: a function of the script, and a handler written in the
markup, which runs on a click and not while the template renders.

**The walrus assigns.** `onclick={() => (open = !open)}` is the commonest line in
a Svelte template, and Python has no short twin: a `lambda` holds an expression,
and `open = not open` is a statement. `(open := not open)` *is* an expression,
Python's own answer to this exact problem, and in a template it writes the
component's name. Plain Python would bind a local that dies with the call, since
PEP 572 binds in the enclosing function and a `lambda` is one, so the ordinary
reading is useless here and the template gives it the only one worth having:

```svelte
<button onclick={lambda: (open := not open)}>menu</button>
<button onclick={lambda: (count := count + 1)}>+1</button>
{#each tabs as one}
    <button onclick={lambda: (tab := one)}>{one}</button>
{/each}
```

Handlers only: a render must not write state, and Svelte says so itself. A `:=`
onto a name of the component anywhere else in the markup is refused at its line,
where Python would bind a name of its own that dies with the expression.

That is the whole of it. Everything else is Python as written: the operators,
the slices, the comprehensions, the f-strings, the truth of an object with
`__bool__`. The wrappers that make a Python value behave like a Python value
inside Svelte's engine are plumbing, and live in
[notes/template.md](notes/template.md).

**The template language follows the script language, with no third mode.** A
component without `lang="python"` is a JavaScript component and stays one, even
when it imports a `.py` store: its `{value}` is Svelte's `{value}`, and a Python
list renders as JavaScript renders it. Nothing is injected behind an author's
back, exactly as TypeScript does not leak into a `.js` file.

It costs **1.3× to 1.7× on rendering** against a JavaScript component (`npm run
bench`, the spread being what a modest laptop measures from one day to the next):
one Python call per expression per render. That is the price of the template
being Python.

### The whole dialect, in one table

Eight forms read as something other than plain Python, five in the markup and
four in the script, the named arrow being in both, and there are no others:
everything else in a component is Python that means what Python means.

| | Where | Reads as | Because |
|---|---|---|---|
| `{row.label}` | markup | a key as well as an attribute | the shape of your data should not dictate the shape of your markup |
| `(open := not open)` | markup, handlers only | an assignment inside an expression | `onclick={() => (open = !open)}` has no Python twin |
| `as {id, name}` | markup, `{#each}` target | unpacking a row by key | Python unpacks by position, and only `match` unpacks by key |
| `importjs X from "…"` | script | a JavaScript import | an import is static, and a keyword makes a computed one unwriteable |
| `doubled => count * 2` | script **and markup** | a derived value | one character from the `=` beside it, and that character is the difference |
| `{x = 2}` | markup | state, scoped to the block | the sign the script already uses; Svelte's `{let}` and `{const}` are JavaScript keywords in a Python file |
| `=> js.console.log(count)` | script | an effect | the same arrow with nothing to name, as `f()` alone is `x = f()` with nothing to keep |
| `value: str <=>` | script | a prop that also travels back up | the fourth binding, and the only one that had to be a word |

A name declared in the markup is scoped to the block that holds it, and `bind:`
writes it. `{draft = …}` declares state, and `{greeting => …}` a derived that
follows it, the same two signs the script uses:

```svelte
{#if editing}
  {draft = user.name}
  {greeting => f"Hello {draft}"}

  <input bind:value={draft} />
  <p>{greeting}</p>
{/if}
```

`:=` is refused on such a name: it writes the script's names, so it would reach a
different one. `bind:` is the way to write a name the markup declared.

The four in the script are the only lines a component holds that Python would
refuse to parse. All four are rewritten **on the same line**, so nothing downstream,
line numbers, tracebacks or source maps, can tell the difference. A plain `.py`
gets neither: a module is Python, and only a file with a template has the
dialect.

The third markup entry is the one that takes rather than overrides. `{a, b}` is a
set in an expression, but a `for` target accepts a name, a tuple, a list, never
a brace, so `as {id, name}` collides with nothing. It fills a hole instead of
covering a meaning, which is why it costs less than the walrus beside it:

```svelte
{#each cats as {id, name}, i}
    <a href="/watch?v={id}">{i + 1}: {name}</a>
{/each}
```

Each key is read by the dot's rule, so a dict and an instance unpack alike, and a
key the row lacks raises the `AttributeError` that `{cat.nmae}` raises; `name="anon"`
gives it a default instead, and `**rest` is the dict of the keys not named, as
in a mapping pattern of a `match`: a mapping's other entries, as `{**row}` reads
them, an instance's other attributes, as `vars(row)` reads them, a JavaScript
object's other own properties, symbols included, as JavaScript's own rest reads
them. One departure from Svelte follows: a symbol taken by a computed key is
left out of the rest, where Svelte's unpacking, which leaves out `String(key)`,
keeps it. The alternative spells the same thing twice: `{cat.id}`, `{cat.name}`.

By position, a starred name is Python's: `[first, *others]` makes `others` a
list, wherever the star stands, as `first, *others = row` does, and a row too
short for it raises what Python raises. Without a star, the brackets keep
Svelte's reading, where a value may be missing or left over: that is what a
default, `[first, second=0]`, is for. `...` is Python's Ellipsis, which nothing
is assigned to, so `...rest` is refused.

## Composition

A Python component has a single instance `<script>`. Children are therefore
imported in a `<script module>`, whose declarations stay visible to the markup.
That block is JavaScript: `<script module lang="python">` is refused, naming the
`.svelte.py` module that shares state between instances, because one component
compiles to one Python module and two would overwrite each other.

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
Python, attributes and descriptors included, since template expressions are
compiled as Python:

```svelte
{item.label}     <!-- attribute -->
{item.double}    <!-- @property, evaluated -->
```

## Derived values and bindings

A derived value is computed from other values and recomputed when they change.
It is written with `=>`, one character away from the assignment beside it:

```python
count = 0            # state: a value
doubled => count * 2 # derived: a calculation
```

That character is the whole difference, and the symmetry is deliberate. Nothing
declares `count` to be state: a bare assignment already says it, and the compiler
reads it off the AST. If naming is not required there, it is not required here
either, which is the argument for an operator rather than a word.

It is also JavaScript's arrow, and that is what a derived is: an expression
re-evaluated rather than a value computed once.

`=>` is a `SyntaxError` in Python, so no valid source can contain one outside a
string or a comment. It is rewritten to `doubled = derived(lambda: (count * 2))`
**on the same line**, so every line number, traceback and source map is
untouched, and `=>` inside a string or comment is left alone. The parentheses
keep what `=` would read: `pair => a, b` is the tuple. A `:=` inside the arrow
is refused, since it would bind its name inside the lambda.

**For anything that needs statements, `@derived` decorates a function:**

```python
first = "Ada"
last = "Lovelace"

@derived
def full():
    return f"{first} {last}"
```

The two forms are Svelte's own split, not an invention of ours:

| Svelte | Svelthon |
|---|---|
| `let x = $derived(expr)` | `x => expr` |
| `let x = $derived.by(() => { … })` | `@derived` on a `def` |

and Python already draws the same line between `lambda` and `def`, so there is
nothing new to learn. `=>` belongs to a component, where the dialect lives; a
plain `.py` writes `@derived` and keeps parsing as Python.

The same arrow with no name to its left is an effect, see
[Effects](#effects).

`{full}` in markup, `full` in Python. The body runs inside `$derived.by`, and
every global it touches goes through a namespace accessor, so **Svelte discovers
the dependencies by itself**, nothing to declare. A derived may read another.
It must be **pure**: writing state inside a derived is rejected by Svelte, and
rightly so.

Writing the name itself is Svelte's write to its derived: after `doubled = 99`
the name is `99` until what the body read changes, then its result again. Only
the declaration installs the body, and a function written there is a value
like any other. An `@effect`'s name bound again holds the new value, and the
effect keeps the body it declared. The body is what the declaration binds,
last, as Python binds a name: a `:=` of the name before it holds its value
until then, and a statement after it on the same line writes the name as any
other does.

`bind:` has to read *and* write, which no single expression does, so its value is
compiled twice, once as an expression and once as an assignment target, into the
pair Svelte takes for exactly this (`bind:value={() => v, (n) => v = n}`). That
is what makes `bind:value={row.label}` work on a dict: the dot finds the key on
the way in and writes to it on the way out.

`bindable()` on an annotation declares a two-way prop: the child may write to
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
`init()` returns are real ones. The default is Svelte's fallback: whenever the
parent leaves the prop `undefined`, bound or passed, the child reads its default
again, so a child that writes `None` to a prop its parent binds reads its default
back, as a Svelte child that writes `undefined` does. A parent binding
`undefined` to a prop with a default is refused when the child mounts, by
Svelte's own check (`props_invalid_value`). `bindable()` and `bindable(None)`
declare no default, as `$bindable()` and `$bindable(undefined)` do.

## Reactivity: one signal per name

The namespace is **not** a `$state` proxy. Svelte would then deep-proxy every
Python value stored in it, and a proxied Brython object fails its own type checks
(`repr((1, 2))` raises *descriptor `__repr__` requires a 'tuple' object but
received a 'tuple'*. Instead every module-level name gets its own `$state.raw`,
published to Brython through an accessor: Python values stay opaque to Svelte.

Rebinding a name is reactive, and so is mutating a container in place:

```python
count += 1          # reactive: rebinds `count`
items = items + [x] # reactive: rebinds `items`
items.append(x)     # reactive: the object says so itself
table["k"] = v      # reactive
```

The second signal is how. Each name carries a value *and* a revision counter, and
the accessor reads both, so a reader depends on the revision too. A mutation
bumps only the counter: nothing is copied, and the object keeps its identity.

Detecting the mutation is the other half, and it is where Python pays off. Svelte
proxies the value in depth, which is unusable here: a proxied Brython object
fails its own type checks. So a watched object gets a marker held outside it, in a
`WeakMap`: the object stays the one Brython made, `type(items) is list` stays true
and `repr` is untouched. Brython routes every write through a handful of functions,
method call, indexed write and read, attribute read and write, augmented
assignment, `del`, and a slot's descriptor, so **eleven dispatch points cover the
whole language**, and an unmarked object pays one `WeakMap` miss.

The marker follows the object, which no compile-time analysis could match:

```python
def fill(target):
    target.append("x")   # the compiler sees nothing here

def add():
    fill(items)          # reactive all the same
```

Nesting comes for free from the same marker. Reading a container out of a watched
one puts it under the same watch, which is what deep proxying buys Svelte, done
lazily and without a single proxy: the child is marked the first time Python
reaches for it, which is necessarily just before it could be mutated.

```python
data = {"rows": []}
data["rows"].append(x)   # reactive: reading data["rows"] put it under watch
```

Measured on `$B.$getitem`, the hottest of them: **+4% on
`xs[i]`**, and +4% again when the marker actually travels.

Attributes work the same way, through `$setattr`, `$setattr1` and `$delattr`, and
`{#each}` hands the watch down to its rows, so a row's block subscribes to the
row itself. Which closes the surprising case: in `{#each items as it (it.id)}`,
`it.label = "…"` re-renders the row **and** keeps its DOM node, since the key did
not move.

Where it stands, each line held by a test:

| | propagates |
|---|---|
| `items.append(x)`, `table[k] = v`, `del table[k]`, `tags.add(x)` | yes |
| `data["rows"].append(x)`, a nested container | yes |
| `box.value += 1`, `del box.extra`, an instance attribute | yes |
| `box.rows.append(x)`, a container held in an attribute, even one set in `__init__` | yes |
| `it.label = …`, an item of a keyed list | yes |
| a mutation made inside a helper the compiler cannot see | yes |
| through a `@derived` that hands back the object, or a component prop | yes |
| a child reached through `.items()`, `.values()` or `.get()` | yes |
| `<p {**attrs}>`, a spread | yes |
| `<p title={items}>`, an attribute carrying the container itself | no, **and neither does JavaScript** |
| `store.rows.push(x)`, a store's container mutated from JavaScript | no, **and `store.rows = [...]` does** |

The first `no` is host semantics, not a limitation of ours: Svelte compares the
value against the one it last applied, by identity, inside its own DOM writer,
where no signal reaches, and a mutated container is the same object. An
idiomatic Svelte component with `$state` behaves exactly the same, which
`tests/parity.test.js` proves by running the same component in both languages,
line for line.

The second is the boundary of the mechanism. The tracking wraps Brython's own
entry points, `call_attr`, `$setitem` and `$delitem`, so a mutation written in
Python notifies wherever it is written, and `Array.prototype.push` called from
JavaScript goes around all three. Replacing the container notifies, since that
goes through the store's setter; the next Python mutation catches up to the true
value. `tests/store-from-javascript.test.js` holds both halves.

Every other line propagates, and a test holds each one.

Accessors live on the namespace's **prototype**, never on the object itself:
rebinding a global emits `$B.delete_for_reassign(name, locals)`, and a `delete`
on an own accessor would drop it for good, silently unhooking the signal after
the very first write.

## Two kinds of `.py`, the way TypeScript has two kinds of `.ts`

Svelte already draws this line for TypeScript, and Python follows it unchanged:

| TypeScript | Python | compiles to |
|---|---|---|
| `helpers.ts` | `helpers.py` | an ordinary JavaScript module |
| `panier.svelte.ts` | `panier.svelte.py` | a reactive module: its names become signals |
| `+page.server.ts` | `+page.server.py` | an ordinary module, which is what a route module is |

Nothing here is our invention. A `.ts` becomes reactive only when it is named
`.svelte.ts`, and the marker is not part of the module's name: `panier.svelte.py`
is imported from Python as `import panier`.

**An ordinary module** is Python compiled to JavaScript, and nothing else. No
runes, no signals, no cost for reactivity it does not use. Its functions are its
exports; `__all__` says otherwise when you want it to:

```python
# peps.py
__all__ = ["chercher", "trouver"]

def chercher(requete=""):
    return [p for p in CATALOGUE if requete in p["titre"]]

...
```

`__all__` is Python's own way of saying what a module exports, and it is the
closest thing the language has to TypeScript's `export` keyword. JavaScript
imports those names directly:

```js
import { chercher } from '$lib/peps.py';
```

It names anything the module binds, not only what it assigns: a class, a
constant, a function, a name brought in by an import. And a name it invents is
refused at compile time, since a module exports what it defines, or once the
module has run when a `from m import *` could have brought it.

An exported name is live, as a JavaScript `export let` is: rebound by the
module, it reads as its new value, a function made a number as that number, and
deleted as `undefined`. A function a reader already took stays the one it took,
as `from m import f` keeps it in CPython, and the same function written again is
the same object. A list, a dict, a set or an instance is the module's own
object, as `m.items` is in Python: changed in place by the module,
`items.append(2)` or `thing.count = 1`, it is changed for the importer, and a
write from JavaScript is the module's. What a function returns to JavaScript
crosses the same way, the object itself rather than a copy. A set reads as a JavaScript `Set`, as
Svelte's own `SvelteSet` does, and a dict keyed by a JavaScript object names
that key by its `toString` when it enters, as a JavaScript object names a key
when it is written: the one name it cannot have is the one a key answered
before the view first looked. Bytes read as a `Uint8Array`, what a `Blob`, a
`fetch` body or a `TextDecoder` takes. That one is a copy, since a Web API takes
no live object for bytes: of a `bytearray`, the bytes it holds when it
crosses, taken again when Python changes it; a byte JavaScript writes into the
copy is not Python's until the copy is handed back. An instance reads as its attributes, calls its methods and prints
by its `__str__`, as a JavaScript class prints by its `toString`, from an import,
from a JavaScript child it is handed as a prop, and from a JavaScript object
Python wrote it into. A `.py`'s `@derived`
is not exported: it is a call made at every read, which an export would freeze
at its first value. `__all__` naming one is
refused, as Svelte refuses to export derived state from a module; export a
function returning it.

**It is the value the module ends with, as Python computes it.** Each statement
at the top level of the module that writes it, spelled with literals, `__all__`,
their methods (`"a b".split()`) and the builtins that only read, `sorted` or
`list`, is run by Python before the module is, at build: a second
assignment replaces the first, `+= "bc"` adds `b` and `c`, `del __all__[0]` and
`.sort()` do what they do, and `.append()` on a tuple is refused with the error
Python raises. What the source does not decide cannot be read before the module
runs, and is refused rather than quietly ignored: `__all__ = sorted(names)`, a
change under an `if`, in a loop or in a function. So is an attribute of a
builtin, `str.mro()`, or one spelled with `_`, `().__class__`: it leads from a
literal to the classes behind it, in the process that builds. So is the list handed on,
`names = __all__` or `list.clear(__all__)`, since what is done to it next is out
of sight; `list(__all__)` is a copy to work on.

**A function an `importjs` call hands back is the function itself**, which is
what makes SvelteKit's remote functions work from Python: `accepted = query(…)`
in a `.remote.py` holds, and exports, the object SvelteKit's own `query()`
built. Anything a framework recognises by identity keeps it across the boundary.

**A `remote.py` or a `*.remote.py` is one module**, its body run as it is
loaded and nothing exported by default, as a route module that SvelteKit loads
when it decides. SvelteKit takes a module for one of remote functions by its
name, a `/` or a `.` then `remote.` (`/[/.]remote\.[^/]+$/`), and refuses a
default export there; any other `.py` has a second half, which a Python
`import` runs.

**Where this departs from CPython**, with SvelteKit or without it: a module
named `remote.py` or `*.remote.py` runs its body as it loads, and not at the
`import` statement, because SvelteKit makes it a remote module by its name.
`import remote` under an `if` not taken runs it all the same.

**A reactive module reads it too.** `__all__` in a `.svelte.py` says what the
store publishes, exactly as it does in a `.py`; without one, the store publishes
every name it has.

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

<p>{store.count} / {store.history}</p>
<button onclick={store.increment}>+</button>
```

Read from JavaScript, a scalar is JavaScript's own, so a price of `0.25` is the
number `0.25`, a container is the Python object itself, whose mutations the
page follows, and a Python function is called as the store's own are, whether
it was defined there or imported.

Its runes are compiled by vite-plugin-svelte, whose module filter the project
widens to accept the extension: one setting, and the same shape the filter
already had for `.svelte.ts`:

```js
svelte({
    preprocess: [python()],
    experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } }
})
```

The filter is an infix, `.svelte.`, followed by one of those extensions, so
`panier.svelte.py` matches and `peps.py` does not: exactly the line the two kinds
draw. Names are exported through accessors: Svelte forbids exporting a reassigned
`$state` binding, and a getter is what keeps the read reactive at the call site
anyway. A name of the module's own may be spelled `store`: JavaScript reads it as
`store.store`, and a function of that name is not also exported by name, since
`store` is the object.

The bridge runs both ways: a component's Python imports the module as an ordinary
Python module and reaches the same signals.

```python
import counter_store

def bump():
    counter_store.increment()
    return counter_store.count
```

`import counter_store` looks for `counter_store.svelte.py`, then `counter_store.py`,
in the importing file's own directory and then along `python({ path: [...] })`,
which plays the part of PYTHONPATH. The importer's virtual module imports its code
first, so it is at hand, and its body runs at the `import` statement, as in
CPython: an import under an `if` not taken or in a function never called runs
nothing, and the module's exception is raised where an `except` can catch it. The
namespace is then published in `$B.imported` under its module name.

## Effects

An effect re-runs whenever a name it *read* has changed. Nothing to declare:
globals go through the namespace accessors, so their reads are signal reads and
Svelte works out the dependencies itself.

So an effect must not change what it reads. `history.append(count)` reads
`history` to find the list, then changes it: the effect re-runs on its own
write, again and again, until Svelte stops it with
`effect_update_depth_exceeded`. Svelte has the same trap with
`history.push(count)`; in Python it is easier to miss, since `append` does not
look like a read.

It is the same arrow as a derived, with nothing to name:

```python
count = 0

doubled => count * 2         # derived: the answer is kept
=> js.console.log(count)     # effect:  it is not
```

A derived and an effect are the one mechanism seen twice: both re-run on the
same signal, and they differ only in whether anyone keeps the answer. Python
already draws that line without a symbol: `x = f()` keeps, `f()` alone is done
for its effect, so the arrow draws it the same way, and the absent name sits at
the head of the line, at the column where the eye looks for one.

Svelte 4 spelled both `$:` and Svelte 5 split them, because a `$:` statement did
not show whether it computed or acted. Three of their four reasons were about
static analysis and do not reach us: dependencies here come from the namespace
accessors at run time, not from reading the source. The fourth is that
legibility, and the first column is the answer to it.

**For anything that needs statements, `@effect` decorates a function**, and the
arrow carries a `lambda`, so it holds an expression, and an effect that assigns
needs the decorator:

```python
@effect
def watch():
    global seen
    seen = f"count={count}"

    def cleanup():
        ...
    return cleanup     # optional teardown, run before each re-run and on destroy
```

**Any Python callable is a teardown**, not only a `def`: `return resource.close`
reads a bound method off an object, and an instance with `__call__` works the
same way. That is the shape most real teardowns take.

| Svelte | Svelthon |
|---|---|
| `$effect(() => expr)` | `=> expr` |
| `$effect(() => { … })` | `@effect` on a `def` |
| `$effect.pre(…)` | `@effect.pre` |
| `$effect.root(…)` | `@effect.root` |

**The trap this model creates**: `runs += 1` on a module-level name *reads*
before it writes, so a counter incremented inside an effect makes the effect
depend on what it writes, and Svelte loops until
`effect_update_depth_exceeded`. A plain assignment reads nothing.

### Before the DOM, and outside a component

`@effect.pre` is the same effect, run **before** the DOM is updated, for the
cases that must read a layout before what they depend on changes, an autoscroll
being the canonical one.

`@effect.root` opens a scope of its own. Nothing cleans it up, which is the
point: **the decorated name receives the destructor**, exactly as JavaScript
names the value the call hands back.

```python
@effect.root
def destroy():
    js.console.log(count)

destroy()          # ends it, while the component is still alive
```

```js
const destroy = $effect.root(() => { $effect(() => { … }); });
destroy();
```

A scope and a moment are different things, so the two compose, which stacking
says in Python, and which their nesting says in JavaScript:

```python
@effect.root
@effect.pre
def destroy():
    ...
```

### Which file may hold what

An effect needs two things: signals to read, and an owner to belong to. The three
kinds of file have them in different measure, and each restriction below is one
of those two.

| | `.svelte` | `.svelte.py` | `.py` |
|---|---|---|---|
| has signals | yes | yes | no |
| belongs to a component | yes | no | no |
| state | `count = 0` | `count = 0` | an ordinary variable |
| derived, short form | `x => expr` | `x = derived(lambda: …)` | *none* |
| derived, long form | `@derived` | `@derived` | `@derived` → a function called on every read |
| effect | `=> expr`, `@effect`, `@effect.pre`, `@effect.root` | `@effect.root` only | none |
| props | `name: str` | become state | become state |

A `.svelte.py` has no component, so `@effect` there would belong to nobody,
`@effect.root`, which owns itself, is the form a module writes. A plain `.py`
holds no signals at all, so no effect there would watch anything. Both are
refused with a message rather than turned into an ordinary function.

## Custom elements

A component that declares `<svelte:options customElement="…">` is compiled as a
custom element, so it can be dropped into any HTML page with no Svelte around
it, its script still Python.

```svelte
<svelte:options customElement="my-stepper" />

<script lang="python">
count = 0


def bump():
    global count
    count += 1
    host().dispatchEvent(js.CustomEvent.new("stepped", to_js({"detail": count})))
</script>

<button onclick={bump}>{count}</button>
```

```html
<my-stepper></my-stepper>
```

Its props are its annotated names, observed as attributes and exposed as
properties, and each attribute arrives as the type its annotation names:
`start: int` reads `start="5"` as `5`, `tags: list` reads a JSON array. A
`bool` follows HTML, as in Svelte: an attribute that is present is true,
whatever its value. A property the page sets back to `undefined` reads its
default again, as a Svelte element's does, `15.0` as Python wrote it.

`host()` is the way back out, and the only one: a custom element speaks to the
page through DOM events rather than props. Without it a component could receive
and render but never answer.

It is bound only where it is read, because Svelte refuses `$host()` at compile
time in a component that is not a custom element.

## Debugging

`inspect(count, message)` is a `console.log` that reruns on its own: it prints
whenever any of the values it was given changes, follows them deeply, and the
production build drops it entirely.

```python
count = 0
message = "hello"

inspect(count, message)
```

```
0 'hello'      on mount
1 'hello'      after count changed
```

One argument per value, as in Svelte.

To replace the logger, `inspect_with` takes the callable first:

```python
def record(kind, *values):
    js.console.table(values)


inspect_with(record, count, message)
```

The callback is handed `"init"` or `"update"` and then the values, and is
trimmed to the parameters it declares: `def record(kind)` is called with one
argument, not three. Svelte writes this as `$inspect(x).with(fn)`, which Python
cannot spell: `with` is a keyword, and `with=` is not an argument name either.
Putting the callable in front is where Python puts one whenever position stops
being enough: `map(fn, *iterables)`, `filter(fn, it)`, `reduce(fn, it)`.

Note that a callback may not write to the component's own state: Svelte forbids
it from inside `$inspect` as it does from inside a `$derived`, which is why a
logger logs somewhere else.

`{@debug user}` is the markup counterpart, and it is ported: each name is read
as Python reads it, and a list or a dict changed in place is logged again, as
Svelte logs a state it follows.

## Lifecycle

By naming convention, backed by a single `$effect`:

```python
def on_mount():
    ...   # after the DOM exists

def on_destroy():
    ...   # on teardown, final state still readable
```

What `on_mount` returns is its cleanup, as with Svelte's `onMount`: a function
returned there runs on teardown, before `on_destroy`. Either may be an
`async def`, which is started, or any value the name holds once the script has
run, however it was bound: `on_mount = lambda: …`, a prop, a name imported from
JavaScript by the script or by the `<script module>`.

Both stay ordinary functions, and Python may call them too. They run **untracked**:
a hook reads the component's names through the namespace accessors, and those
reads *are* signal reads. Without `untrack`, a `mounts += 1` inside `on_mount`
would make the effect depend on state it also writes, and Svelte loops until
`effect_update_depth_exceeded`. The teardown function is captured while the
component is alive: reading a signal from an already-destroyed teardown returns
nothing.

Each instance gets its own namespace, since the Python module body re-runs on every
mount, mutable defaults included.

## Async

An `async def` handler runs. Calling one from JavaScript returns a coroutine
nobody runs, so the wrapper hands it to Brython's own event loop.

```python
from browser import aio

rows = []

async def load():
    global rows
    await aio.sleep(0)      # or aio.get(...) for a real request
    rows = ["…"]
```

`@effect` on an `async def` runs too, as Svelte runs `$effect(async () => …)`:
what it reads **before its first `await`** is what it follows, and nothing it
returns is taken for a cleanup.

## Context

`set_context` and `get_context` are injected into every component, like
`derived` and `effect`. Both must run while an instance initialises, which is
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
between requests, unlike a store, whose state lives in the module.

## Source maps

Brython scatters `$B.set_lineno(frame, N)` through the code it generates, so the
generated JavaScript carries the Python line each statement came from. That is
enough for a line-level source map, emitted with every virtual module: a
debugger opens the `.svelte` or `.py` file rather than a thousand lines of
generated JS.

Line-level, not column-level: one Python line maps to the run of generated
lines that implement it. A test decodes the map and checks a known statement
lands on its real line, because a map that points at the wrong place is worse
than no map at all.

## SvelteKit

A dependency, not a fork. SvelteKit delegates `.svelte` files to
vite-plugin-svelte, which applies the preprocessor declared in
`svelte.config.js`, and our Vite plugin sits alongside `sveltekit()`. One setting
is needed, and it is one SvelteKit already provides for exactly this:

```js
// vite.config.js, where SvelteKit 3 configures everything
export default defineConfig({
    plugins: [
        svelthon(),
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
| page options | `prerender`, `ssr`, `csr`, exported through `__all__` |
| cookies, `setHeaders` | through `event["js"]`, no bridge of ours involved |
| `handle`, `handleError` | in Python, behind a two-line JavaScript shim |
| `reroute`, client `handleError` | likewise, universal and client hooks |
| nested layouts | `+layout.server.py` at each level, data merged |
| `+page.py` | a universal `load()`: on the server, then in the browser on a client navigation |
| `+server.py` | a pure-Python endpoint, building its own `Response` |
| form actions | `actions = {"default": noter}`, with `await request.formData()` |
| `error()`, `redirect()`, `fail()` | called from Python |
| dynamic routes | `event["params"]["numero"]` |
| a `.py` imported from JavaScript | by its named exports |

Streaming falls out of the same rule. A coroutine handed to the framework
becomes a promise, and what it resolves to makes the same crossing:

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

...
```

That page ships **no JavaScript at all**, and therefore no Brython. A component
written in Python, delivered as bare HTML. With `prerender = True` instead, the
Python runs at build time and the page is a file on disk.

### The two bridges

Python cannot import from npm. A **component** says so with `importjs`, in the
same script as the rest of its Python:

```python
importjs Star from "#lib/Star.svelte"
importjs {fade, fly} from "svelte/transition"
importjs * as Dialog from "#lib/ui/dialog"
importjs Player, {stopAll} from "#lib/Player.svelte"
importjs "./theme.css"
```

The clause is JavaScript's own, because the keyword has already said which
language it names: there is nothing new to learn, and no ambiguity to invent
between a default import and a named one. `Star` is then a component the markup
can use and a name Python can read.

**Calling one converts in both directions.** A Python callable handed to a
JavaScript function crosses as a JavaScript one, and what comes back crosses the
other way: `cubicOut(0.5)` is a Python `float` you can round and format, not a
foreign number. The conversion is deliberately conservative, since a plain object,
an array and a promise are returned untouched, so a value you hand straight back to
JavaScript is not mangled on the way through, and an awaited promise still
awaits. A list, a dict, a set or an instance handed to it is Python's own, as a
JavaScript caller hands its array: a library that keeps it reads what Python
changes next, and what it writes is Python's. An API that clones, `postMessage`,
IndexedDB, `history.pushState`, takes `to_js(value)`, a copy, as Svelte's
`$state` takes `$state.snapshot`; so does a library that sets fields of its own
on the array it is given, Chart.js among them, and one that reads a large set of
data over and over, which a view answers one read at a time.

It is a keyword rather than a declaration for one reason: an import is static,
and a keyword makes a computed one **unwriteable** instead of merely wrong. It is
also the only place a component's script departs from Python, and it departs
visibly, the same trade the markup already makes with `{#if}` and the walrus.

A plain `.py` has no markup, so it never imports a child component, a stylesheet
or a namespace: it only ever calls the framework. It therefore keeps `__js__`,
and keeps parsing as Python: an ordinary assignment read from the AST, exactly
like the `__all__` beside it:

```python
__js__ = {"@sveltejs/kit": ["error", "fail"]}
__all__ = ["load", "actions"]

...
```

One rule, in one line: **a file with a template has the dialect; a module is
Python.**

Either way, the name is JavaScript's import, and Python reads it as JavaScript
does, live: what its module writes next, Python reads next. It never binds it,
since JavaScript never assigns an import: `counter = 0` or a `global counter`
then assigned is refused when the file compiles, with its line, and a write at
run time, `globals()["counter"] = 0`, raises `TypeError`. A value of your own
takes another name.

For the platform itself, `js` is the JavaScript globals and `to_js()` converts a
Python container into something a Web API will accept:

```python
def GET(event):
    corps = js.JSON.stringify(to_js(chercher(event["query"].get("q", ""))))
    return js.Response.new(corps, to_js({"headers": {"content-type": "application/json"}}))
```

### The boundary converts, both ways

SvelteKit wraps `params` and `url` in proxies that record every key read, so it
knows what a `load()` depended on, and Brython probes an object's symbols as it
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

`event` carries `params`, `query`, `url`, `method`, `route`, and `js`, the raw
event. That last one is the escape hatch, and it is enough on its own:

`query` is a dict, so a key written twice keeps the **first** value, which is
what `url.searchParams.get()` answers about the same URL. Every value of a
repeated key is behind the escape hatch:
`event["js"].url.searchParams.getAll("tag")`.

```python
biscuits = event["js"].cookies
theme = str(biscuits.get("theme") or "clair")
biscuits.set("theme", "sombre", to_js({"path": "/"}))
event["js"].setHeaders(to_js({"x-svelthon": "bonjour"}))
```

The same treatment reaches inside an exported **dict of functions**, which is
what `actions` is: each one gets its arguments converted, its coroutine awaited
and its result converted back. What is *not* a Python container, a `Response`,
a `Promise` or an `ActionFailure`, is passed through untouched.

**A callable crosses as its call, and not as its fields.** A function, a bound
method and an instance whose class defines `__call__` all arrive as JavaScript
functions, wherever they were written: under a name, in a list, in a mapping, in
what another function returned. What does *not* arrive is the object's own
attributes: they stay in Python, where the call still reaches them, so a strategy
object keeps its state and JavaScript keeps its call.

| on a callable | crosses |
|---|---|
| `handler.factor`, any attribute of the object | no, **and Python still has it** |
| `handler.name` | as the function's `name`, because a JavaScript function has one either way |
| `handler.length` | no: `length` is the arity the call declares |

The two exceptions are the two words a JavaScript function already owns. `name`
takes the author's own when there is one (`on_save` says more in a log than
`Handler.__call__`), and `length` is what a library reads to learn what a
callback takes. Both describe the *call*; neither is the field beside it.
`tests/callable-matrix.test.js` holds every line, across **13 shapes** and **14
positions**, and each shape again as the callee of a directive.

A Python function is handed only the arguments it declares, so `def clear_all():`
serves as an `onclick` and the event is left out. So is a builtin type's own
method that takes no positional argument, `rows.clear`, `rows.reverse`,
`rows.sort` or `"hi".upper`: `onclick={rows.sort}` sorts the list. Any other
builtin method is handed everything JavaScript passes, and does with it what
Python would: `onclick={rows.pop}` raises, since the event is no index, and
`onclick={rows.append}` appends the event, as a `def add(item)` would receive it.
Wrap them: `onclick={lambda: rows.pop()}`, or a `def`.

A method read off a JavaScript object stays bound to it, as Python binds any
method it reads, wherever Svelte calls it: a handler, an `{@attach}`, a
transition. `onclick={field.focus}` focuses the field and
`onclick={history.back}` goes back, where Svelte hands the method the button. A
handler that wants the element reads `event.currentTarget`.

### The one place SvelteKit is hard-coded

Hooks are found by `resolve_entry`, which matches `/\.(js|ts)$/` and ignores
`moduleExtensions`, so `src/hooks.server.py` is never seen. A two-line shim
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
`ERR_UNKNOWN_FILE_EXTENSION`. They stay JavaScript: one file, a few lines.

## Server-side rendering

It works. Svelte compiles a second version of each component that returns an
HTML string instead of creating DOM nodes, so the Python body runs under Node,
which is what the compiler already does at build time. Two shims were missing
from the browser runtime (`self`, `addEventListener`); Bryntime now sets them,
and that was the whole obstacle.

Covered by `tests/ssr.test.js`: components, props, composition with child
components and attribute access, and the Python values themselves: `-7 // 2`
still
renders `-4` server-side.

**The one real trap, and it is not specific to Svelthon.** A store's state lives
in the module, so it is shared by every request the process serves. Svelte warns
about exactly this for module-level `$state` in a `.svelte.js`. Harmless when
**prerendering**, one pass with no concurrent users, and a data leak under
per-request rendering. Svelte's answer is context, and Python has it: what
belongs to one request goes through `set_context` and `get_context`, not into a
store.

Prerendering is the simplest target: it needs no server, it fits the
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
numbering: a `<script module>` placed before the Python does not skew it. A
Python **syntax error** at build time is reported the same way, rather than as an
empty object Vite cannot describe.

The component survives the exception, the next handler still works, and a
Python `try/except` stays a Python `try/except`: the wrapper only applies to what
reaches JavaScript.

## HMR

A component's generated code lives in a virtual module, a separate entry in
Vite's graph, tied to nothing. Without explicit invalidation, editing the Python
re-transforms the component while still serving **the previous generated body**:
the page updates to code that never changed. The plugin's `hotUpdate` hook
invalidates the component's virtual modules, and `npm run test:hmr` checks both
paths.

A store goes through a different path, `load()` rather than the preprocessor,
and had the same illness, worse: its own `.svelte.js` module has to be
invalidated too, or its `load()` never re-runs and the cache keeps the old body.

## What a component can import

`browser` (with `browser.html` and `browser.aio`), `javascript`, and any `.py`
sitting beside the component or on the configured `path`. Python's standard
library does not ship: `import json`, `import math` or `from browser import
timer` is refused on its line when the component compiles, with what stands in
for it where there is something. So is what would reach for it at run time, a
`type` alias or a generic `def f[T]`, `__reduce__()` and `help("name")`, and
so are the builtins a page cannot run: `eval`, `exec` and `compile`, which need
a parser the runtime leaves out, `__import__` and `open`. A module is found by its file name alone: a
subdirectory is not a package, so `from lib import models` is refused too, and
`models.py` is imported as `import models` once `lib` is on `path`. Everything else a template needs is already a
name: `tojson`, `from_json`, `batch`, `date`, `fromnow`, `slugify`, `striptags`,
`urlencode`, and `js` for the platform's own, `js.Math` and `js.Date`.

`tojson` writes what JSON has a notation for and **refuses the rest by name**
rather than writing `{}` or `null`: a set, bytes, a range, a complex, a
coroutine, a promise, a `Map`, a `Set`, and `nan` or `inf`, which JSON cannot
spell and `json.dumps` writes in a form no `JSON.parse` reads back. A JavaScript
class says how it serialises by carrying
`toJSON`, and one that does not is refused too, since nothing can tell its fields
from a `Map`'s. It walks a structure about **2 500 levels deep** at most, where
`json.dumps` writes 20 000: deeper, the engine's stack overflows. `striptags` shows the visible document, so the text of a
`<script>` or a `<style>` never reaches the page.

`date` reads **a date with no time as a calendar day**, rendered as that day
wherever it is read. `"2026-08-24"` is 24 August for everyone, which is what
`datetime.date` means and what Django's `|date` shows; the specification reads
such a string as midnight UTC, so without the rule every reader west of
Greenwich saw the day before. A value carrying a time is an instant and is
rendered in the reader's own zone, which is what an instant is for.

The runtime is Bryntime's, and a browser gets it without the parsing chain,
which only the compiler loads; Bryntime's README gives its weight.

## Svelte surface covered

Measured, not assumed (`tests/svelte-surface.test.js`): all of this works inside
a Python component:

| | |
|---|---|
| blocks | `{#if}` `{:else if}` `{#each}` (indexed, `{:else}`, keyed) `{#key}` `{#await}` |
| tags | `{@html}` `{@render}` `{#snippet}` `{@attach}` `{@debug}` |
| snippets | declared, rendered, given to a child inside its tag **or by name** |
| bindings | `bind:value` `bind:checked` `bind:group` `bind:this` |
| directives | `class:` `style:` `use:` `transition:` `in:` `out:`, naming a function of a **Python module** too |
| composition | props, defaults, spread of a **Python dict**, children as snippets, the instance API through `@export` |
| elements | `<svelte:window>` `<svelte:head>` `<svelte:boundary>` |
| styles | scoped `<style>` |

Template expressions are Python throughout, including the corners that are not
interpolations: the iterable of an `{#each}`, its key, `{#key}`, the right-hand
side of a declaration, `{@html}`, the attachment of an `{@attach}`, the shorthand
`{name}`, the spread `{**attrs}`, and an interpolation inside a quoted
attribute, as in `class="tag {statut.lower()}"`.

Two Python spellings are accepted where Svelte has its own: `{#each d.items() as
(k, v)}` destructures a tuple, and `{#each xs as x, i}` keeps Svelte's meaning of
item and index. What a component imports or declares in its `<script module>` is
readable from Python too, which is how a Python component reaches a JavaScript
library at all.

## Status

Validated by `npm test`, 1 950 tests as written (vitest reports more, one per
row of a `test.for`), none expected to fail:

- end-to-end reactivity, and which write paths propagate;
- props: Python defaults, parent precedence, readability during init, parent
  updates flowing through to Python;
- **semantic fidelity grid**: integers, text, protocols, control flow, frames.
  Every expected value was produced by running the component's Python through
  CPython 3.12 as-is, never written by hand. Brython matches CPython on **every
  point**;
- production build: **225 KB gzip**, Brython runtime included.

The grid doubles as an acceptance bench for optimising code generators: one that
drops call frames breaks `Frames`, one that unboxes integers breaks `Integers`,
one that short-circuits `augm_assign` breaks `Protocols`.

### Known divergences

One, and it is Svelte's, not a bug: a `$derived` that hands back the object it
was given compares equal to itself, so nothing propagates from it, which is why
a reader subscribes to the object rather than to the derived (see
[Reactivity](#reactivity-one-signal-per-name)).

## Editor support

Not a gap in Svelthon, but worth knowing: the Svelte TextMate grammar falls back
to **JavaScript** for an unrecognised `lang`, so `<script lang="python">` is not
left uncoloured: it is coloured wrongly, `#` comments included.

The grammar already lists `coffee` beside `ts`, so adding `python` upstream in
`svelte-language-tools` follows an existing precedent. A grammar injection
shipped as a small editor extension is the other route.

### Hydration

Svelte's own runner drives every sample in three modes, client, server and
**hydrate**, and the third is where the two halves have to agree, since the
Python body runs on both sides. Covered by `tests/hydration.test.js`:

- the server's nodes are **reused, not rebuilt**: node identity survives, which
  is the proof hydration actually happened;
- Python is wired to those reused nodes: a click still increments;
- **on a mismatch the client value wins, silently.** No warning. A
  non-deterministic component, reading the clock, a random, a session, will not
  crash; it will paint one value and then flip to another.

The exact server output, hydration markers included, is asserted in
`tests/ssr.test.js`, so the two files cannot drift apart.

## What it costs at runtime

Measured with `npm run bench`: the same component written twice, once in Python
and once in JavaScript, driven through real clicks in a headless Chromium. Click
dispatch costs the same on both sides, so the gap between the columns belongs to
the handler. Seven alternating rounds, the minimum kept: the least polluted
measurement, not the average of the machine's interruptions.

| | Python | JS | gap |
|---|---:|---:|---:|
| warm mount | 0.3 ms | 0.2 ms | ~1.5× |
| 2000 handler calls | 28 ms | 18 ms | **~1.5×** |
| 1500 × sum of 500 squares | 1128 ms | 15 ms | **50–100×** |
| rendering a 500-row keyed list | 5.0 ms | 8.0 ms | **0.6×** |

Three things to take from it.

**Calling into Python is cheap**, about 1.5× a JS handler. Frames and
`augm_assign` cost something, but nothing that a click will ever notice.

**Python computation is one to two orders of magnitude slower.** The ratio swings
between 50× and 100× across runs, which is the honest range on a modest laptop.
Keep hot loops out of a component, or reach for the C extensions
[Wasthon](https://github.com/fgallaire/wasthon) compiles to WebAssembly.

**Rendering is not slower, it is faster.** Consistently, across every run. Svelte
deep-proxies the objects inside a `$state` array; Svelthon's names are
`$state.raw`, so Python values are never proxied. The reactivity design pays for
itself exactly where a real application spends its time.

Loading is the real price: **1.2 s to interactive** for the production demo on
this laptop, against 0.5 s for the same page without Brython: 225 KB gzip
instead of 13 KB. Paid once per session, not per page, since the app never
reloads.

## Not done yet

**Blocks a real application**

- **Publishing.** The package is defined, its `exports` and its `files`, and it
  is not on npm yet, so the `npm install svelthon` of the quick start waits for
  it.


**Design notes**: [notes/template.md](notes/template.md) on what a template
expression is compiled into and the five adapters under it,
[notes/directives.md](notes/directives.md) on the four ways a directive's value
becomes Python and the two things left over, and
[notes/dicts-and-objects.md](notes/dicts-and-objects.md) on what a dict and a class
instance each cost at the boundary, measured side by side, and backed by
`tests/shapes.test.js`, and [notes/one-interpreter.md](notes/one-interpreter.md)
on why Brython loads twice in one process and what it would take to load it once.
[notes/crossings.md](notes/crossings.md) is the index of the boundary itself: the
thirteen converters in one table, which door to use, and the three failures that
show when the wrong one is chosen.

**Coming from Django or Flask?** [DJANGO_FLASK.md](DJANGO_FLASK.md) maps every
everyday template construct onto its Svelthon counterpart, the whole translation
fitting on one page, and its worked example is a test fixture, so it cannot drift.

**Upstream, in Brython**

The internals of Brython's compiler that Svelthon depends on are written up in
**[BRYTHON.md](BRYTHON.md)**, the contract between the two projects. At run
time Svelthon reaches the engine through Bryntime alone, which keeps its own.

## Running

```sh
npm install
npm test             # fidelity grid, props, reactivity (jsdom), then the browser check
npm run test:quiet   # a green run must say nothing
npm run test:browser # the browser check alone: DOM interop, the markup pass and the demo
npm run test:hmr     # virtual-module invalidation
npm run test:kit     # a SvelteKit production build, served
npm run test:all     # all of the above, stopping at the first failure
npm run dev          # the demo, at /demo/
npm run build
```

### A non-obvious setting in `vite.config.js`

`optimizeDeps.entries: []`, since Vite's dependency scanner runs **ahead** of the
plugin pipeline: it reads the HTML entries, hits `<script lang="python">` and
hands the Python to a JavaScript parser, then fails on `./store.py`, which no
file of that name is meant to serve. Its only job here is to discover bare
imports, so the scan is skipped and the one package worth pre-bundling is named.

### Brython, through Bryntime

Svelthon carries no copy of Brython. It depends on **Bryntime**, the Brython
runtime for JavaScript frameworks, which holds the crossing between Python and
JavaScript, and which Svelthon reaches through its one entry, `bryntime`. The
engine is **Bryve**, Brython with its fixes, started where it is imported, on
which Bryntime runs and from which Bryc, the compiler, loads the parsing chain,
`bryve/compiler`. Until they are published, both are installed from checkouts
beside this one, `../bryntime` and `../bryve`. Which engine ships, built from
what and with which repairs, is Bryve's to say.

**And it is the only Python that ships.** No stdlib module travels with
Svelthon, `sys` included: a stdlib exists so that an author can `import`
something, which is Brython's job, not a component framework's. A need that is
identified becomes a builtin of ours instead, injected into the namespace with
nothing to import. What the engine already carries stays reachable, `browser`
and `_sys` among them.

## The wider stack

Svelthon stands on its own, a Python frontend framework, nothing more required.
But because it runs on Brython rather than a sandboxed interpreter, everything
built for Brython is available to a component: notably
[Wasthon](https://github.com/fgallaire/wasthon), which brings CPython's real C
extension modules to the browser as WebAssembly, and
[NumBry](https://github.com/fgallaire/numbry), which builds the scientific stack
(NumPy, pandas, SciPy, matplotlib, Pillow, SymPy) on top of it.

That matters for how much you ship. Where a full CPython-in-WebAssembly runtime
arrives as one large payload, these are per-module `.wasm` files, and Svelthon
already knows exactly which modules a component imports: `py2js()` exposes them,
so only the ones actually named need travel.

## Licence

Svelthon is MIT, the licence of Svelte and of the tooling around it. See
`LICENSE`.

Bryntime, which Svelthon depends on, is BSD-3-Clause, the same licence as
Brython.
