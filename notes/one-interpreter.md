# One interpreter per process

*Open. The correctness half is fixed and the demo runs; what is left is waste and
a choice between two ways of removing it.*

## Two loads of one file

`compile.cjs` reaches Brython with `require`, because it is CommonJS. A component
reaches it with `import`, through `runtime.js`. Node keeps a CommonJS `require`
and an ES `import` of the same file as **two module instances**, so
`vendor/brython.js` executes twice in one process — and the second execution
rebuilds `$B.ast`, leaving the classes the compiler is already holding without
the `to_js` methods the code generator attached to the first set.

Compiling anything after that dies inside Brython:

```
TypeError: ast_root.to_js is not a function
    at $B.js_from_root (vendor/brython.js:16468)
    at $B.py2js (vendor/brython.js:14279)
```

which names nothing that leads back here.

## Why it is not always fatal

Two instances are survivable. What is fatal is the *order*: the second execution
landing **between** two compilations.

- The test suite has both instances and stays green — 213 tests.
- The playground never has them in one scope: the compiler runs in a worker, the
  interface in the page, the compiled component in an iframe.
- The demo has them, and it does server rendering. `hooks.server.py` compiled
  fine; the first render then pulled `runtime.js` into the SSR graph, and every
  `.py` route module compiled after that failed.

So the bug was latent for as long as nobody disturbed the order. Clearing
`node_modules/.vite` disturbed it.

## What is in place

`vendorQuirks()` wraps the copy Vite serves so that it does nothing when an
interpreter already exists:

```js
if (!(globalThis.__BRYTHON__ && globalThis.__BRYTHON__.ast)) { …the whole file… }
```

Only the served copy is guarded, so the one the compiler requires always wins and
the runtime shares it. `var` keeps its module scope inside a block, which is what
lets the file be wrapped without touching a line of it.

This makes the order stop mattering. It does not remove the second load: Vite
still transforms and serves 1.4 MB for a module that then declines to run.

## Two ways to finish, and what each costs

**Make `compile.cjs` an ES module** so both halves share one instance. The reason
given for CommonJS — that `brython.js` must run after the globals, which hoisted
imports cannot order — no longer holds on its own: `runtime.js` already gets that
order right with three separate imports, and module imports execute in sequence.
The real cost is elsewhere, and it is why this has not been done: Vite **bundles
`vite.config.js`**, and a static import would pull Brython and the standard
library into that bundle. Measured today: the bundled config is 75 KB and
contains none of Brython, precisely because `require` keeps it out. The 6 MB
figure that would replace it is inferred, not measured.

**Stub the vendored file for the SSR environment only.** The server side never
needs to load Brython — the compiler has already done it in the same process,
before any render. Resolving `vendor/brython.js` to an empty module for SSR alone
leaves the browser untouched, since a browser has no compiler and must load it
for real. Around ten lines in the plugin.

The second is smaller and lower risk. Neither is done.

## What made this expensive to find

Our own error reporting hid it. `pythonError` in `compile.cjs` assumed every
failure was a Brython exception, so a JavaScript `Error` came out as
`JSObject: <Javascript object: [object Error]>` — the real message was gone.
A real `Error` is now returned untouched, and that one change turned an
unreadable failure into a stack that named the file and the line.

The other cost was method: the demo had not been started for two days, and
nothing in the test suite compiles a `.py` *after* server rendering has begun. A
green suite said nothing about this.
