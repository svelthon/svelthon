# Dicts and objects at the boundary

*Both work. This note records what each costs, because the difference is not
where it looks like it is.*

## What a dict is, on the way out

A Brython `dict` exposes its string keys as ordinary enumerable JavaScript
properties. So a dict is already half-way across: `{#each}` walks it, `{...d}`
spreads it, and `d["k"]` and `d.k` both read it once it has been converted.

What it is *not* is plain data. It carries symbol-keyed internals —
`Symbol(OB_TYPE)`, `Symbol(VERSION)` — which SvelteKit's serialiser refuses
outright. That is why `plainData` exists at every export boundary.

## What an object is, on the way out

A class instance keeps its attributes under a **private symbol**, not as
JavaScript properties. Walking its own keys finds almost nothing and wanders into
the class object instead — which loops, and used to exhaust the stack:

```
RangeError: Maximum call stack size exceeded
```

`plainData` now reads the instance dict, so an object crosses as its fields.
**Only the fields.** A `@property` lives on the class, so it does not travel —
which is what `JSON.stringify` does with a class instance in JavaScript too. If a
computed value has to make the trip, compute it in `__init__`.

Cycles terminate: the guard tracks the branch being walked, not every value ever
converted, so the same object twice in one list comes out twice. Covered by
`tests/objects.test.js`.

## Where they genuinely differ

**Through `js.`** — the global bridge — Brython's own conversion runs, not ours.
It handles dicts and lists and leaves a class instance untouched, so
`js.JSON.stringify(some_object)` reports a circular structure. Only there does the
choice change what you must write:

```python
body = js.JSON.stringify(to_js(peps.search("")))   # objects need it
```

Through `__js__` imports, exported functions, remote functions and component
props, both cross without help.

## Which to use

There is no rule, and the earlier claim in this project that a fixed set of
fields "should" be a class was a preference dressed as a principle.

**A dict fits when** the data arrives as JSON and leaves as JSON — a dict is the
shape at both ends and a class is a detour; when keys are dynamic; when `.get()`
with a default reads better than `getattr`; when there is nothing but data.

**An object fits when** the record is read far more often than it is built —
`p.year` beats `p["year"]` in a comprehension; when a computed field should be
worked out once, at construction; when behaviour belongs with the data.

The demo uses both deliberately: `peps.Pep` is a class because a PEP is read
everywhere and carries a computed `url`; `notes.NOTES` is a dict because it is
keyed by PEP number; and a `load()` returns a dict, because what a route hands
its page is a bag of named things, not a record.

## The one thing to avoid

Do not choose per site. A codebase where the same record is a dict in one module
and a class in the next costs more than either choice does.
