# Architecture, in five layers

Svelthon is the top of a stack of five layers, each one a package with a
single job, so that each can be read, tested and replaced on its own. A
component written in Python goes through all five; a page receives only the
three that run.

| Layer | Package | Its job | Where it runs |
| --- | --- | --- | --- |
| Brython | upstream | Python's semantics in JavaScript: a compiler and a runtime | through Bryvend |
| Bryvend | `bryvend` | Brython's master with the repairs proposed upstream and not merged yet, one commit each, as an ES module in two halves: the runtime, and the compiler (`bryvend/compiler`) | the runtime in the page and on the server; the compiler at build |
| Bryntime | `bryntime` | the crossing between Python's values and JavaScript's: live views, change tracking, calls, errors, modules, and pickle from one process to another | in the page and on the server |
| Brycomp | `brycomp` | Python compiled for a host: scopes, exports, JavaScript imports, template expressions, source maps | at build |
| Svelthon | `svelthon` | the Svelte and SvelteKit side: the preprocessor, the Vite plugin, the bridge to Svelte's state, Python routes and hooks, the transport | at build, and in the page |

Each layer reaches the ones under it by their public entry and nothing else.
Svelthon reaches the engine through Bryntime alone; Bryntime asks of Brython only what it writes
down member by member; and a repair of Brython is made in Brython, proposed
upstream, and carried by Bryvend until it is merged, never worked around
higher up.

## A component, from source to page

**At build**, the Svelte preprocessor hands the `<script lang="python">` to
Brycomp, which compiles it with Bryvend's compiler under Node. The generated
code goes to a virtual module, because Svelte forbids the `$` that Brython's
code opens with; the component's own script binds each Python name to a Svelte
state and calls it. Svelte then compiles the component as it compiles any
other: its markup, its styles and its runes are Svelte's.

**In the page**, nothing is compiled. The page loads Bryvend's runtime half,
Bryntime and the generated code: JavaScript only, the compilation having
already happened. Each name the script binds is one signal; a mutation made
in Python, `rows.append(x)` or `point.x += 1`, happens inside the engine, where
Svelte cannot see it, and Bryntime tells Svelte, so the page follows Python as
it follows a `$state`.

## Two kinds of crossing

A value crosses between Python and JavaScript in two places, and they are not
the same problem.

**Inside one process**, the page or the server, Python and JavaScript share
memory. A Python list handed to a JavaScript component is read as an `Array`
that *is* the list: its reads are live, and its writes are Python's. Props, callbacks, stores, imports and
contexts cross this way, through Bryntime's views and conversions.

**Between two processes**, the server and the browser, a copy is unavoidable:
the data travels as text. SvelteKit renders a page on the server and again in
the browser from that copy, and both renders must read the same values. For
Python's values, Bryntime writes pickle, Python's own way of carrying a value
from one process to another, and Svelthon installs it in SvelteKit's
`transport`: a tuple stays a tuple, an `int` key an `int`, an `int` exact at
any size, a shared object one object, a cycle a cycle, and an instance of a
class an instance of it. It goes one way only: the server never rebuilds a
class from what the browser sends.

## The rule that decides

Where a behaviour has to be chosen, the side it is written in decides. What is
written in Python behaves as CPython runs it: a dict keeps its insertion order,
an `int` is exact, `async for` and a comprehension mean what they mean in
Python. What Svelte defines, the template, the lifecycle, SvelteKit's routes
and options, behaves as Svelte and SvelteKit do. Each place where Svelthon
cannot do both is written in the README as a divergence, with its reason.

## How it is held

- The README's code blocks are compiled by the suite, and the figures it
  states are measured by it: neither can drift from the code.
- A production build of a SvelteKit application is served and read in a
  browser, in production and under the development server: what its pages
  read on the server is compared, value by value, with what they read in the
  browser.
- A browser check runs the demo, the DOM interop and the markup pass in
  Chromium, and a green run of the suite must print nothing.
- Each repair of Brython that Bryntime rests on is held by a test in
  Bryntime, so a new Brython that loses it fails there first.

## Where each part is written

- [The README](../README.md): what an author writes, and what it does.
- [crossings.md](crossings.md): the converters at the boundary, and which one
  to use.
- [template.md](template.md) and [directives.md](directives.md): what a
  template expression and a directive's value are compiled into.
- [dicts-and-objects.md](dicts-and-objects.md): what a dict and an instance
  each cost at the boundary.
- [one-interpreter.md](one-interpreter.md): why Brython loads twice in one
  process, and what it would take to load it once.
- [BRYTHON.md](../BRYTHON.md): the internals of Brython's compiler that
  Svelthon depends on.
- Bryntime's README: the crossing's own contract, pickle's included.
