# Django templates, in Svelthon

If you write Django or Flask templates, you already know most of this page. What
follows is the whole translation — there is not much of it, and nothing to
install for it.

Two rules cover almost everything:

1. **An expression is Python.** `{{ x }}` becomes `{x}`, and what goes inside is
   the Python you would write anywhere else — `len(items)`, `x.upper()`,
   `sorted(rows)`. No filter language, no restricted subset.
2. **A block is a Svelte block.** `{% if %}` becomes `{#if}`, `{% endif %}`
   becomes `{/if}`. The `#` opens, the `/` closes, the `:` continues.

That second rule is the only genuinely new thing, and it is worth stating why it
exists rather than a `{% %}` lookalike: every page of Svelte's documentation,
every tutorial and every answer online applies to Svelthon with one substitution
— JavaScript for Python. A second block syntax would spend exactly that.

## The whole mapping

| Django | Svelthon |
|---|---|
| `{{ pep.title }}` | `{pep.title}` |
| `{{ pep.title\|upper }}` | `{pep.title.upper()}` |
| `{{ note\|default:"—" }}` | `{note or "—"}` |
| `{{ body\|safe }}` | `{@html body}` |
| `{% if a %}…{% elif b %}…{% else %}…{% endif %}` | `{#if a}…{:else if b}…{:else}…{/if}` |
| `{% for x in xs %}…{% endfor %}` | `{#each xs as x}…{/each}` |
| `{% for x in xs %}…{% empty %}…{% endfor %}` | `{#each xs as x}…{:else}…{/each}` |
| `{{ forloop.counter }}`, `forloop.first`, `forloop.last` | `{#each xs as x, i}` then `{i + 1}`, `i == 0`, `i == len(xs) - 1` — see below |
| `{% with n=xs.count %}…{% endwith %}` | `{@const n = len(xs)}`, inside a block — see below |
| `{% include "card.html" %}` | `<Card />` |
| `{% extends "base.html" %}` | a `+layout.svelte` above the page |
| `{% block content %}…{% endblock %}` | `{@render children()}` in the layout |
| `{% comment %}…{% endcomment %}` *stripped* | `<!-- … -->` *stripped* |
| `<!-- … -->` *delivered* | `{@html "<!-- … -->"}` *delivered* |
| `{% csrf_token %}` | nothing to write — see below |
| `{% url 'pep' n %}` | `href="/pep/{n}"` — see below |

Autoescaping works the same way in both, which is worth knowing before you look
for a setting: everything is escaped, and `{@html}` is the deliberate way out,
exactly as `|safe` is in Django.

Two lines of that table need a word. The first is the comment.

In Django the distinction matters: `{% comment %}` is stripped at render, while
`<!-- … -->` is passed through and lands in the page source — which is exactly
why `{% comment %}` exists. Svelte has no such split. An authored `<!-- … -->` is
removed from the output, on the server and in the browser alike, so it *is* the
template comment; only Svelte's own hydration markers survive. Measured on
5.56.9: a component whose template holds a comment renders `<!--[--><p>1</p><!--]-->`.

Which leaves the other half of Django's pair with no default: to put a real
comment in the delivered HTML you have to force it, either with
`{@html "<!-- … -->"}` or by turning on the compiler's `preserveComments`. Rarely
what anyone wants, and worth knowing before you go looking for the setting.

Neither framework chose this. Django's lexer recognises three things — `{{ }}`,
`{% %}`, `{# #}` — and re-emits everything else verbatim, so a comment *cannot*
disappear, and a second form had to be invented for the case where you want it
to. Svelte parses to a tree and emits only what has rendering semantics, so a
comment cannot survive; it also uses comments as its own hydration markers, which
makes the character one it has already spent. The axis is not server against
client — Svelte drops them under server rendering too. What looks like a feature
on one side and a gap on the other is the shape of the engine, twice.

One line of that table has a catch. `{% with %}` goes anywhere; `{@const}` must be
the immediate child of a block — `{#if}`, `{#each}`, `{#snippet}`, `{:then}`, a
component — and Svelte refuses it at the top level of a file. Which is rarely a
problem, because the place you reach for `{% with %}` is usually inside a loop
anyway. When it is a problem, the value belongs in the script:

```svelte
<script lang="python">
@derived
def n():
    return len(xs)
</script>
```

## A page, side by side

A list with a filter, a counter and an empty state — the template every project
writes on its first day.

**Django**

```html
{% extends "base.html" %}

{% block content %}
<h1>{{ status|default:"All" }} PEPs</h1>

<ul>
  {% for pep in peps %}
    <li>
      {{ forloop.counter }}.
      <a href="{% url 'pep' pep.number %}">PEP {{ pep.number }}</a>
      — {{ pep.title }}
    </li>
  {% empty %}
    <li>Nothing here.</li>
  {% endfor %}
</ul>

<p>{{ peps|length }} shown</p>
{% endblock %}
```

**Svelthon**

```svelte
<script lang="python">
peps: list
status: str
</script>

<h1>{status or "All"} PEPs</h1>

<ul>
  {#each peps as pep, i}
    <li>
      {i + 1}.
      <a href="/pep/{pep.number}">PEP {pep.number}</a>
      — {pep.title}
    </li>
  {:else}
    <li>Nothing here.</li>
  {/each}
</ul>

<p>{len(peps)} shown</p>
```

`{% extends %}` has no counterpart in the file because layouts are a directory
convention: a `+layout.svelte` beside the page wraps it, with no declaration on
either side.

The two annotations at the top are what a Django view passed in its context.
Here they are the component's inputs, and they are ordinary Python annotations —
no rune, no decorator.

## Where Svelthon does it differently

### Template inheritance

Django names a parent and fills its blocks. Svelthon nests by directory: a
`+layout.svelte` wraps every page below it, and renders the page with
`{@render children()}`. Layouts nest, so a section can add its own without the
pages knowing.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="python">
children: object
</script>

<header>…</header>
<main>{@render children()}</main>
```

For a single hole this is about even. For several — Django's named blocks — you
pass snippets as props, which is more machinery than `{% block %}`. It is also
more capable, since a snippet takes arguments.

### The loop, and the object it does not have

Django gives a loop a `forloop` object, Jinja a `loop`. Svelthon has neither, and
this is the one place where the difference is worth a section rather than a row.

The position comes from the block header, exactly as `enumerate` gives it in
Python or `.map((x, i) => …)` in JavaScript:

```svelte
{#each rows as row, i}
    <li>{i + 1}. {row.title}</li>
{/each}
```

Everything `forloop` carries is then an expression:

| Django | Jinja | Svelthon |
|---|---|---|
| `forloop.counter0` | `loop.index0` | `i` |
| `forloop.counter` | `loop.index` | `i + 1` |
| `forloop.first` | `loop.first` | `i == 0` |
| `forloop.last` | `loop.last` | `i == len(rows) - 1` |
| `forloop.revcounter` | `loop.revindex` | `len(rows) - i` |
| — | `loop.length` | `len(rows)` |
| `{% cycle "a" "b" %}` | `loop.cycle("a", "b")` | `["a", "b"][i % 2]` — but see below |
| `{% ifchanged %}` | `loop.changed(row.cat)` | `i == 0 or rows[i - 1]["cat"] != row["cat"]` |
| — | `loop.previtem` | `rows[i - 1] if i else None` |
| `forloop.parentloop` | `loop.parent` | name the outer index: `{#each xs as x, i}{#each x.ys as y, j}` |

**Grouping into rows** is the one thing an index does not give you — Django has no
answer, Jinja spells it `items|batch(3)`, and Svelthon injects `chunks`:

```svelte
{#each chunks(items, 3) as row}
    <tr>{#each row as cell}<td>{cell}</td>{/each}</tr>
{/each}
```

A third argument pads the last row, which is what keeps a table's columns
aligned — `chunks(items, 3, "")`, positional as in Jinja.

Python has `itertools.batched` and it works here, but it is not free: `itertools`
is 10 KB of standard library and pulls `operator` behind it, for a component that
wanted three columns. It is also a lazy iterator, so a name holding one comes back
empty the second time it is read. `chunks` returns a list of lists, takes any
iterable — a generator included, which a slicing comprehension cannot — and needs
no import. JavaScript, for its part, has no equivalent at all.

**Reach for CSS before any of these.** A component carries its own scoped
stylesheet, which a Django or Jinja template never does — so striping a table,
dropping the last separator or numbering the rows is presentation, and belongs in
the `<style>` block:

```svelte
<ul>
    {#each rows as row}
        <li>{row.title}</li>
    {/each}
</ul>

<style>
    ul { counter-reset: n }
    li { counter-increment: n }                    /* forloop.counter */
    li::before { content: counter(n) ". " }
    li:nth-child(even) { background: #f6f6f6 }     /* {% cycle %} */
    li:not(:last-child)::after { content: " · " }  /* forloop.last */
</style>
```

This survives a filtered list, an item removed, a row inserted in the middle —
none of which an index-based test does without care.

**Why no `loop` object.** Django and Jinja render once, top to bottom, into a
string: when the engine reaches item *n* it already knows the length and the
items before, so `loop.last` and `loop.previtem` are free. Svelte does not render,
it updates — each row is a block that re-runs when what it reads changes. There,
`loop.last` makes every row depend on the list's *length*, and `loop.previtem`
makes each row depend on its neighbour, so editing one row invalidates two more.
The index is the smallest reactive unit, and it lets you choose the dependency
instead of inheriting it.

That is also why every incremental renderer landed in the same place — Vue's
`v-for="(item, index) in xs"`, React's `xs.map((item, index) => …)`, Angular's
`let i = $index`. None of them reintroduced `forloop`.

### Filters

A Django filter is a small language: `{{ x|striptags|truncatewords:20 }}`. In
Svelthon it is Python, so it is functions and methods — often shorter, sometimes
less pretty when it nests. The gain is that there is nothing to learn and nothing
to register: any function your module can import, the template can call.

### URLs — an honest regression

`{% url 'pep' pep.number %}` resolves a *named* route, so renaming a URL does not
break templates. SvelteKit has no named routes: you write `/pep/{pep.number}`,
and renaming the directory means grepping for the path. If your project leans on
`{% url %}` heavily, this is the thing you will miss.

### CSRF

`{% csrf_token %}` has no equivalent because SvelteKit does not use a token: it
compares the request's `Origin` to the app's own and refuses a cross-site form
post. Nothing to write in the form — but the origin must be right, or every POST
comes back `403`. See `paths.origin` in the SvelteKit configuration.

## What Svelte adds, and Django never needed

A Django template renders once, to a string, and the page is done. A Svelthon
template also renders on the server — but then keeps running in the browser, and
that changes what the syntax has to express.

**Keys.** `{#each rows as row (row.id)}` tells Svelte which DOM node belongs to
which row, so a reordered list moves nodes instead of rewriting them. Django
never needed this, having no DOM to keep. It is optional, and it is the first
thing to reach for when a list updates.

**Awaiting.** `{#await rows}loading…{:then rows}…{:catch e}…{/await}` renders the
three states of a promise. A Django template has no such thing because the view
resolved everything before rendering.

**Reactivity.** This is the real difference, and it is not in the template at
all. Assign to a module-level name in Python and everything reading it re-renders:

```svelte
<script lang="python">
count = 0

def increment():
    global count
    count += 1
</script>

<button onclick={increment}>{count}</button>
```

No rune, no decorator, no `setState`. That is the whole feature, and it is why
the template can afford to look like Svelte's rather than Django's — the parts
that would have been familiar are not where the work is.

## Where a Svelthon template is genuinely different

**It is not a restricted language.** Django deliberately limits templates to keep
logic in views. Svelthon does not: `{len([p for p in peps if p.year > 2020])}`
compiles and runs. Whether that is freedom or rope is a matter of taste, and the
old advice still applies — a `@derived` in the script reads better than a
comprehension in the markup.

**It runs in the browser too.** The Python in a component is compiled to
JavaScript by Brython at build time and shipped. A `+page.server.py` stays on the
server, exactly as a Django view does; a component does not.

**Its data is not a context dict.** A Django view returns a context; a Svelthon
page declares its inputs as annotations, and a `+page.server.py` returns them
from `load()`. Same idea, and the names line up.
