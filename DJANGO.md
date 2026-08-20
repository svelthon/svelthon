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
| `{{ forloop.counter }}` | `{#each xs as x, i}` then `{i + 1}` |
| `{% with n=xs.count %}…{% endwith %}` | `{@const n = len(xs)}`, inside a block — see below |
| `{% include "card.html" %}` | `<Card />` |
| `{% extends "base.html" %}` | a `+layout.svelte` above the page |
| `{% block content %}…{% endblock %}` | `{@render children()}` in the layout |
| `{% comment %}…{% endcomment %}` | `<!-- … -->` — see below |
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
