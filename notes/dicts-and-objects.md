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
        <li><a href={url(pep)}>PEP {pep.number}</a> — {pep.title} ({pep.year})</li>
    {/each}
</ul>
```

Two things are visible at once, and they are the trade in miniature. The data is
shorter as dicts — the class is eleven lines of ceremony for three fields. And
the computed field changes side: a `@property` reads like any other field in the
markup, where the dict has to call a function that takes the record back as an
argument.

What is *not* visible any more is the markup, and that is deliberate: the dict
version reads `{pep.title}` too. The dot in a template expression finds a key as
well as an attribute — see below — so the two shapes are written the same way at
every read site. `{pep["title"]}` still works and means exactly the same thing.

## Side by side

| | object | dict |
| --- | --- | --- |
| read in the markup | `{p.title}` | `{p.title}`, or `{p["title"]}` |
| read inside an attribute | works | works |
| computed field (`@property`) in the markup | works | impossible |
| mutated in place, reactively | works | works |
| passed as a component prop | arrives as `Pep` | arrives as `dict` |
| handed to another module's function | arrives as `Pep` | arrives as `dict` |
| spread into a child, `{...record}` | its attributes arrive | arrives whole |
| what crosses an export boundary | its fields, never a `@property` | everything |
| what a key may be called | a Python identifier | any string |

## The two failures were debts, not properties

Two cells of this table used to differ, and neither was a fact about the shape.
Both were ours, and both are paid.

**A dict handed to another module's function** arrived as a JavaScript object:
`d["k"]` still read, `.get()`, `.items()` and `isinstance(d, dict)` did not. The
module's namespace was a plain JavaScript object to Brython, and the call
converted its arguments on the way in. The function read off a module is the
Python function itself now, so the argument arrives as it was made; and the
namespace is a `module` (`pythonModule` in `runtime.js`), whose attributes are
read through a dict delegating to its accessors. Measured in
`tests/crossing.test.js`.

**An object spread into a child** contributed nothing, and the child fell back
on its defaults: a class instance keeps its attributes under a private symbol,
so `{...record}` found no enumerable property. The spread takes what `**rest`
takes of an instance, its attributes. Measured in `tests/shapes.test.js`.

The choice between the shapes is preferred, not forced, at every site.

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

## Shortening the object side: `@dataclass`, and what it costs

The obvious answer to the eleven lines of ceremony is a dataclass, and it works —
fields, a `@property` beside them, generated `__eq__` and `__repr__`, a field
mutated in place still reactive. `tests/dataclass.test.js` holds all five.

What it costs was measured on the same component:

| | stdlib modules bundled | shipped |
| --- | --- | --- |
| `@dataclass` | 212 | 2.9 MB |
| `class` with an `__init__` | 0 | 0 |

`dataclasses` pulls in `inspect`, `copy`, `types`, `re`, `enum` and their whole
closure, and a component's standard library travels to the browser with it. Seven
lines saved against 2.9 MB delivered is not a trade, and the same closure is what
makes that component take seconds to mount the first time.

So: not in a component. In a `+page.server.py`, which never reaches a client, a
dataclass costs nothing at all and the ceremony is worth removing. The rule is
not about the shape, it is about which side of the wire the module lives on.

## One dot for both

The dot in a template expression finds an attribute first and a key second.
`{pep.title}` reads a class instance or a dict, and `{pep["title"]}` still means
what it always did. Implemented in `runtime.js` as `inTemplate`, exercised by
`tests/dot.test.js`.

This is what Jinja does — `foo.bar` tries the attribute then the item, and its
documentation says the two spellings are interchangeable. Django's template
language goes further still, dictionary then attribute then numeric index, but
for a different reason worth not confusing: DTL has no `[]` and no `()` at all,
so its dot is forced to carry every kind of access. Jinja has both and unifies
anyway, out of regard for whoever writes the template. That is our situation.

**It is not a new kind of divergence.** A template expression already differs
from the same text in the script, and by more than this: `{#if items}` compiles
through `__truthy`, so an empty list is false the Python way rather than the
JavaScript way; `{items}` through `__text`, so it renders `['a', 'b']` and not
`a,b`; an iterable through `__seq`, a spread through `__spread`, a `{#key}`
through `repr()`. Four implicit wrappers were already there, deliberately. The
dot is the fifth, and the smallest of them.

**A typo stays loud.** `{pep.titel}` tries the attribute, fails, tries the key,
fails, and raises the `AttributeError` it always raised — with its position. This
is the one place Jinja is weaker: its `Undefined` renders nothing at all.

**A real attribute wins over a key of the same name.** `{d.items}` is the dict's
own method, not a key called `items`; `{d["items"]}` is the key. That is Jinja's
order, and it is what keeps the subscript worth having.

**How far it reaches**, pinned by a test rather than assumed: the fallback lasts
for the length of one expression, so a helper the markup calls gets it too, and
the same helper called from `on_mount` does not. That is the seam, and it is the
price of the feature — a function that works from the markup and raises from a
lifecycle hook. It is the same shape as `__truthy`: `{#if items}` and `if items:`
have never meant quite the same thing either.

**It costs nothing when it is not used.** Brython's generated code reads
`$B.$getattr_pep657` off the object at every call, so the fallback is installed
by swapping that one function for the length of an expression and restoring it
after — two property writes per expression, and every attribute access in the
rest of the program untouched. The same technique as `withNamespace`. A miss
costs no exception either: the probe passes a default rather than catching.

## The one thing to avoid

Do not choose per site. A codebase where the same record is a dict in one module
and a class in the next costs more than either choice does.
