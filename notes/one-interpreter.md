# One interpreter per process

*Open. The correctness half is fixed and the demo runs; what is left is waste and
a choice between two ways of removing it.*

*2026-10-17: `compile.cjs` loads no engine. Bryntime loads and starts it
(the `bryntime` package since 2026-10-19), and every way into the compiler
reaches Bryntime first:
`src/lib/compile.js` for `svelthon/compile`, the plugin, the suite's setup.
The plugin reaches it by `require`, which the bundled config does not follow:
imported, the engine entered that bundle, 10 files where it held 6, loaded in
360 to 375 ms where it took 160 to 220, and its `eval` was warned about on a
green run. What follows describes the two loads as they were.*

*2026-10-20: `compile.cjs` is `compile.js`, an ES module, and the plugin
imports it: no file of Svelthon is CommonJS any more. Vite keeps the
`bryntime` package out of the bundled config, which holds Svelthon's own
fifteen files and none of Bryntime's, loaded in the time it took before.*

## Two loads of one file

`compile.cjs` reaches Brython with `require`, because it is CommonJS. A component
reaches it with `import`, through `bridge.js`. Node keeps a CommonJS `require`
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
  fine; the first render then pulled `bridge.js` into the SSR graph, and every
  `.py` route module compiled after that failed.

So the bug was latent for as long as nobody disturbed the order. Clearing
`node_modules/.vite` disturbed it.

## What is in place

The file guards itself: `vendor/brython.js` opens with

```js
if (!(globalThis.__BRYTHON__ && globalThis.__BRYTHON__.ast)) { …the whole file… }
```

and `var` keeps its module scope inside a block, which is what lets 4.6 MB be
wrapped by adding two lines. The order stops mattering: whichever instance runs
first wins, and the second declines.

This started life in a Vite plugin, patching the copy it served. That was wrong
in a way that took a real bug to see: the plugin only ever reached the *browser's*
copy, so the compiler — which loads the same file with `require` under Node — ran
on an unrepaired Brython. Everything else the plugin patched was in the same
position, and `/api/py` in the demo, an endpoint that builds its own `Response`,
returned 500 on a defect that was supposedly fixed. The plugin is gone; every
repair is an edit in the engine Bryntime ships, which lists them and holds them
by its own tests.

It still does not remove the second load: Vite transforms and serves 1.4 MB for a
module that then declines to run.

## Two ways to finish, and what each costs

**Make `compile.cjs` an ES module** so both halves share one instance. The reason
given for CommonJS — that `brython.js` must run after the globals, which hoisted
imports cannot order — no longer holds on its own: `bridge.js` already gets that
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

## Three things that worked for reasons nobody had chosen

Clearing `node_modules/.vite` broke three things at once, and none of them was a
regression in the ordinary sense. Each had been resting on a property that was
true but unwritten.

**The order of the two Brython loads.** Described above. The cache decided when
the served copy executed, and it happened to execute before it could do harm.

**The removal of Brython's DOM stubs.** Bryntime records the globals that exist
before Brython loads, and removes whatever it added once the engine has started
— that is what stops a library testing `typeof document` from taking the
browser path and dying on `window is not defined`. But the compiler loaded
Brython through `require`, without that record, so its stubs were never in the
snapshot. It worked because the *served* copy re-executed after the snapshot
was taken, and the cleanup could see those stubs. Guarding that re-execution
removed the accident along with the bug. The compiler then took the same
snapshot itself, before its own load; it has loaded no engine since 2026-10-17.

**The demo's own playground page.** It has no `+page.js`, so SvelteKit rendered
it on the server, although it imports `compile.cjs` — CommonJS. It worked because
SSR loaded that file natively rather than converting it, so `require` existed.
That is an inference, not a measurement: what is measured is that clearing the
cache produced `require is not defined`. The page now declares `ssr = false`,
which states what was always true — the compiler runs in the browser — instead of
depending on how Vite treats a `.cjs` on a given day.

## What made this expensive to find

Our own error reporting hid it. `pythonError` in `compile.cjs` assumed every
failure was a Brython exception, so a JavaScript `Error` came out as
`JSObject: <Javascript object: [object Error]>` — the real message was gone.
A real `Error` is now returned untouched, and that one change turned an
unreadable failure into a stack that named the file and the line.

The other cost was method: the demo had not been started for two days, and
nothing in the test suite compiles a `.py` *after* server rendering has begun. A
green suite said nothing about this.
