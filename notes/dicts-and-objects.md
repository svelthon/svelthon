# Dicts and objects at the boundary

*Both work. This note records what each costs — measured, not argued, because
the differences are not where they look like they are. The table is backed by
`tests/shapes.test.js`, which puts one record in both shapes through every place
it can be read or handed on.*

## The same page, both ways

Same output, down to the markup — `tests/shapes.test.js` renders both and
compares. What differs is what you write.

**As objects:**

```svelte
<script lang="python">
class Pep:
    def __init__(self, number, title, year):
        self.number = number
        self.title = title
        self.year = year

    @property
    def url(self):
        return "https://peps.python.org/pep-{:04d}/".format(self.number)


peps = [
    Pep(8, "Style Guide for Python Code", 2001),
    Pep(703, "Making the GIL Optional", 2023),
]
</script>

<ul>
    {#each peps as pep}
        <li><a href={pep.url}>PEP {pep.number}</a> — {pep.title} ({pep.year})</li>
    {/each}
</ul>
```

**As dicts:**

```svelte
<script lang="python">
peps = [
    {"number": 8, "title": "Style Guide for Python Code", "year": 2001},
    {"number": 703, "title": "Making the GIL Optional", "year": 2023},
]


def url(pep):
    return "https://peps.python.org/pep-{:04d}/".format(pep["number"])
</script>

<ul>
    {#each peps as pep}
        <li><a href={url(pep)}>PEP {pep["number"]}</a> — {pep["title"]} ({pep["year"]})</li>
    {/each}
</ul>
```

Three things are visible at once, and they are the whole trade in miniature. The
data is shorter as dicts and the class is eleven lines of ceremony for three
fields. The markup is quieter as objects — `{pep.title}` against
`{pep["title"]}`, four times over, and the difference grows with every field read.
And the computed field changes side: a `@property` reads like any other field in
the markup, where the dict has to call a function that takes the record back as
an argument.

## Side by side

| | object | dict |
| --- | --- | --- |
| read in the markup | `{p.title}` | `{p["title"]}` |
| read inside an attribute | works | works |
| computed field (`@property`) in the markup | works | impossible |
| mutated in place, reactively | works | works |
| passed as a component prop | arrives as `Pep` | arrives as `dict` |
| **handed to another module's function** | arrives as `Pep` | **arrives as a JavaScript object** |
| **spread into a child, `{...record}`** | **nothing arrives** | arrives whole |
| what crosses an export boundary | its fields, never a `@property` | everything |
| what a key may be called | a Python identifier | any string |

## The two failures are debts, not properties

Neither of the bold cells is a fact about the shape. Both are ours.

**A dict handed to another module's function** arrives as a JavaScript object:
`d["k"]` still reads, `.get()`, `.items()` and `isinstance(d, dict)` do not.
`registerModule` puts a plain JavaScript object into `$B.imported`, so Brython
sees the imported module as foreign and its functions as JavaScript functions —
the call converts its arguments on the way in, and the function underneath is
Python, so nothing converts them back. Reads and return values survive, because
the `PYOBJ` cache finds the original Python object again. Measured in
`tests/crossing.test.js`. Marking the namespace as a module does not fix it and
cannot: `$B.module.tp_getattro` reads attributes from a dict attached to the
object, while ours live as accessors on a prototype — a plain property would be
destroyed by the `delete_for_reassign` Brython emits before every global
rebinding. What remains is to give the namespace a dict of *own* accessors
delegating to those.

**An object spread into a child** contributes nothing, and the child falls back
on its defaults. A class instance keeps its attributes under a private symbol,
so `{...record}` finds no enumerable property. `py.spread` could read the
instance dict — `plainData` already does exactly that.

Until both are paid, the shapes are not interchangeable at those two sites, and
that is the only place where the choice is forced rather than preferred.

## What each is on the way out

A Brython `dict` exposes its string keys as ordinary enumerable JavaScript
properties. So a dict is already half-way across: `{#each}` walks it, `{...d}`
spreads it, and `d["k"]` and `d.k` both read it once it has been converted. What
it is *not* is plain data — it carries symbol-keyed internals, `Symbol(OB_TYPE)`
and `Symbol(VERSION)`, which SvelteKit's serialiser refuses outright. That is why
`plainData` exists at every export boundary.

A class instance keeps its attributes under a **private symbol**. Walking its own
keys finds almost nothing and wanders into the class object instead — which
loops, and used to exhaust the stack with a `RangeError` naming no file at all.
`plainData` reads the instance dict now, so an object crosses as its fields.
**Only the fields**: a `@property` lives on the class and does not travel, which
is what `JSON.stringify` does with a class instance in JavaScript too. If a
computed value has to make the trip, compute it in `__init__`. Cycles terminate —
the guard tracks the branch being walked, not every value ever converted, so the
same object twice in one list comes out twice. Covered by `tests/objects.test.js`.

Through `js.` — the global bridge — Brython's own conversion runs instead of
ours. It handles dicts and lists and leaves a class instance untouched, so
`js.JSON.stringify(some_object)` reports a circular structure:

```python
body = js.JSON.stringify(to_js(peps.search("")))   # objects need it
```

## Which to use

There is no rule, and the earlier claim in this project that a fixed set of
fields "should" be a class was a preference dressed as a principle. What that
claim had going for it is real enough — a class fails loudly on a missing field,
at construction, where `{"numer": 703}` fails quietly at the first read; an
editor completes `p.` and flags `p.titel`; the record has a name. What it lacked
is any of the four differences above, which are the ones that decide.

**A dict fits when** a key is not a Python identifier — `content-type`, `class`,
`2023` — and that one is not a preference: `{p.content-type}` in the markup is a
subtraction, so those keys are *unrepresentable* on an object. It fits when the
data arrives as JSON and leaves as JSON, when keys are dynamic, and when the
record is spread rather than read field by field.

**An object fits when** the record is read far more often than it is built —
`p.year` beats `p["year"]` in a comprehension — when a computed field should be
worked out once, when behaviour belongs with the data, and when the record is
handed to another module's function, which today only an object survives.

The demo uses both deliberately: `peps.Pep` is a class because a PEP is read
everywhere and carries a computed `url`; `notes.NOTES` is a dict because it is
keyed by PEP number; and a `load()` returns a dict, because what a route hands
its page is a bag of named things, not a record.

## The one thing to avoid

Do not choose per site. A codebase where the same record is a dict in one module
and a class in the next costs more than either choice does.
