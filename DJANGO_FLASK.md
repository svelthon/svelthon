# Django, Flask and Jinja templates, in Svelthon

If you write Django or Jinja templates, Flask's included, you already know most
of this page. What follows is the whole translation — there is not much of it,
and nothing to install for it.

The two languages differ from each other about as much as either differs from
Svelthon, so both are spelled out wherever they part.

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

A blank cell means the two on its left are spelled the same.

| Django | Jinja | Svelthon |
|---|---|---|
| `{{ pep.title }}` | | `{pep.title}` |
| `{{ pep.title\|upper }}` | | `{pep.title.upper()}` |
| `{{ note\|default:"—" }}` | `{{ note\|default("—", true) }}` | `{note or "—"}` |
| `{{ body\|safe }}` | | `{@html body}` |
| `{{ comment\|linebreaks }}` | *none* | `white-space: pre-wrap`, or split — see below |
| `{{ d\|timesince }}` | *none* | `{fromnow(d)}` — see below |
| `{{ d\|timeuntil }}` | *none* | `{fromnow(d)}`, the same one — see below |
| `{% if a %}…{% elif b %}…{% else %}…{% endif %}` | | `{#if a}…{:else if b}…{:else}…{/if}` |
| `{% for x in xs %}…{% endfor %}` | | `{#each xs as x}…{/each}` |
| `{% for x in xs %}…{% empty %}…{% endfor %}` | `{% for %}…{% else %}…{% endfor %}` | `{#each xs as x}…{:else}…{/each}` |
| `{{ forloop.counter }}`, `forloop.first`, `forloop.last` | `{{ loop.index }}`, `loop.first`, `loop.last` | `{#each xs as x, i}` then `{i + 1}`, `i == 0`, `i == len(xs) - 1` — see below |
| `{% with n=xs.count %}…{% endwith %}` | `{% set n = xs\|length %}` | `{@const n = len(xs)}`, inside a block — see below |
| `{% include "card.html" %}` | | `<Card />` |
| `{% extends "base.html" %}` | | a `+layout.svelte` above the page |
| `{% block content %}…{% endblock %}` | | `{@render children()}` in the layout |
| `{% comment %}…{% endcomment %}` *stripped* | `{# … #}` | `<!-- … -->` *stripped* |
| `<!-- … -->` *delivered* | | `{@html "<!-- … -->"}` *delivered* |
| `{% csrf_token %}` | `{{ form.csrf_token }}`, Flask-WTF | nothing to write — see below |
| `{% url 'pep' n %}` | `{{ url_for('pep', n=n) }}` | `href="/pep/{n}"` — see below |

**Autoescaping is the one place where knowing which of the two you come from
matters.** Django always escapes. Bare Jinja does **not**: `autoescape` is
`False` unless you turn it on, measured on 3.1.6. Flask turns it on for you, for
templates whose name ends in `.html`, `.htm`, `.xml` or `.xhtml`. Svelthon
escapes like Django, always, and `{@html}` is the deliberate way out, exactly as
`|safe` is in both.

`default` differs the same way and it is easy to miss: Django's replaces a
*falsy* value, Jinja's replaces only an *undefined* one unless you pass its
second argument. `{note or "—"}` is Django's reading, which is almost always the
one intended.

Two lines of that table need a word. The first is the comment.

In Django the distinction matters: `{% comment %}` is stripped at render, while
`<!-- … -->` is passed through and lands in the page source — which is exactly
why `{% comment %}` exists. Jinja has the same split, spelled `{# … #}`. Svelte
has no such split. An authored `<!-- … -->` is removed from the output, on the
server and in the browser alike, so it *is* the template comment; only Svelte's
own hydration markers survive. Measured on 5.56.9: a component whose template
holds a comment renders `<!--[--><p>1</p><!--]-->`.

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

The Jinja version of that page differs in three places and nowhere else:
`{{ status|default("All", true) }}`, `{{ loop.index }}`, and `{% else %}` where
Django writes `{% empty %}` — plus `{{ url_for('pep', number=pep.number) }}` for
the link.

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

The two annotations at the top are what a Django or Flask view passed in its
context. Here they are the component's inputs, and they are ordinary Python
annotations — no rune, no decorator.

## Where Svelthon does it differently

### Template inheritance

Django and Jinja name a parent and fill its blocks, identically. Svelthon nests
by directory: a `+layout.svelte` wraps every page below it, and renders it with
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

For a single hole this is about even. For several — their named blocks — you
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
answer, Jinja spells it `items|batch(3)`, and Svelthon injects `batch`:

```svelte
{#each batch(items, 3) as row}
    <tr>{#each row as cell}<td>{cell}</td>{/each}</tr>
{/each}
```

Without a third argument the last row is simply short. Passing one pads it, which
is what keeps a table's columns aligned — `batch(items, 3, "")`, positional as in
Jinja. `None` there means no padding, like every other helper on this page.

`batch` takes any iterable — a generator included, which a slicing comprehension
cannot — and returns a list of lists rather than a lazy iterator, because an
`{#each}` reads its rows again on every update and an iterator would come back
empty the second time. JavaScript, for its part, has no equivalent at all.

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

### Dates

`{{ pep.created|date:"j F Y" }}` in Django; bare Jinja has no date filter at all,
so a Flask project installs **Flask-Babel** and writes
`{{ pep.created|dateformat("long") }}`. Both keep their word here:

```svelte
{date(pep.created)}                      <!-- 24 août 2026 -->
{date(pep.created, "full")}              <!-- lundi 24 août 2026 -->
{date(pep.created, "short", "short")}    <!-- 24/08/2026, 10:30 -->
{date(pep.created, "long", None, "en-US")}
```

Four styles — `short`, `medium`, `long`, `full` — instead of Django's format
letters, because they come from the platform's `Intl` and answer **in the
reader's own language**. `|date:"j F Y"` never did: its month names are whatever
the server was configured for.

The value is whatever a component actually receives: an ISO string, a date alone,
a timestamp in **milliseconds**, a JavaScript `Date`. Which matters, because a
date crossing from a `load()` or a `fetch` arrives as a string, and there is no
`datetime` to parse it with.

Milliseconds because that is what `Date` counts and what `js.Date.now()` gives.
An API that answers Unix **seconds** is the one thing to watch: the number is
valid either way, so nothing can refuse it, and `1787000000` reads as January
1970 rather than August 2026. Multiply by 1000. Anything that is not one of those
four shapes is refused by name rather than coerced, which is where `date([2026])`
used to answer 1 January 2026.

**Under server rendering, pass the locale.** Without it the server formats in its
own language and time zone, the browser reformats in the visitor's, and Svelte
reports a hydration mismatch. The same holds for the time zone, which `Intl`
takes from the runtime; for anything beyond these four styles, `js.Intl` is
there.

**Coming from Flask-Babel, the output is the one you already have.** Babel and
`Intl` both read CLDR, so the answers match — measured, `format_date(d,
format='long', locale='fr')` gives `24 août 2026`, which is what `{date(d,
"long")}` renders. The difference is that nothing is installed and no locale data
travels: the reader's browser already holds every language.

### Relative time, which keeps itself right

`{{ pep.created|timesince }}` and `{{ pep.launch|timeuntil }}` are **one name
here**, and it is neither of theirs. Flask has no filter for this either: with
Flask-Babel you call `format_timedelta(d - now, add_direction=True)` yourself,
which is already the one-name shape.

```svelte
{fromnow(pep.created)}              <!-- il y a 3 jours -->
{fromnow(pep.launch)}               <!-- dans 2 heures -->
{fromnow(pep.created, "en-GB")}     <!-- 3 days ago -->
```

Django needs two filters because it measures an absolute duration and puts the
direction in the name — each one answers `0 minutes` for a date on the wrong
side. `Intl` formats a **signed** gap, so the direction rides in the value and
`since` would lie half the time. `fromnow` is what the JavaScript world calls it,
in `moment` and `dayjs` alike. Babel's `add_direction=True` is the same choice,
and its output is the same too — measured, `dans 3 jours` and `il y a 2 heures`.

It also gains the one thing Django could not give either filter:

A Django page is finished when it is sent, so "3 minutes ago" is true once and
wrong a minute later. A component stays on screen, so this one **wakes itself**
when the shown value would change — nothing to write, no `setInterval`, no
`{% now %}` passed through the context.

It asks for exactly the delay the display needs: a second while it counts
seconds, an hour once it counts days. So it slows down on its own as a date ages,
and one timer serves the whole document however many dates are shown — a tick
re-runs the blocks that read a relative time, and nothing else.

This is the direction reversed. Everywhere else on this page Django lends
Svelthon a word; here Svelte gives the filter something a template engine that
renders once cannot have.

### Why the blocks are Svelte's and not Django's

`{% if %}` and `{% for %}` over the Svelte blocks was written and tried, then
ruled out. The reasons, in the order they settled it:

**Svelte's documentation is the asset.** Every page of it, every tutorial and
every answer online applies here with one substitution — JavaScript for Python.
A second block syntax spends exactly that, and spends it forever.

**The friction was never `{#if}`.** It was `items.length` against `len(items)`,
and template expressions already settled that: what goes inside the braces is
Python. Once an expression is Python, `{#if}` costs three characters of habit.

**And a faithful translation runs out within three constructs.** Django has no
key for a loop, no `{#await}`, no `{#snippet}`. At the fourth one it has to
invent — and an invented `{% %}` is a dialect, not a familiar syntax. The
argument for it was familiarity; it stops being familiar precisely where a
component needs it most.

### Filters

A Django filter is a small language: `{{ x|striptags|truncatewords:20 }}`. In
Svelthon it is Python, so it is functions and methods — often shorter, sometimes
less pretty when it nests. The gain is that there is nothing to learn and nothing
to register: any function your module can import, the template can call.

The handful with no Python one-liner have a helper of their own, listed in the
README: `tojson`, `batch`, `date`, `fromnow`, `slugify`, `striptags`,
`urlencode`. Every one of them rests on a browser primitive — `JSON.stringify`,
`Intl`, `DOMParser`, `URLSearchParams` — so a template is written without ever
importing anything.

**`|truncatewords` is a stylesheet, not a filter.** Cutting at twenty words cuts
at an arbitrary place: depending on the width it overflows or leaves a gap.
Clamping by *rendered lines* is what you actually wanted, it adds the ellipsis
itself, and it follows a resize:

```css
.summary {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
```

A component carries its own scoped stylesheet, which a Django template never
did — so this is the same move as `{% cycle %}` and `forloop.last` above. Where
the truncation is genuinely semantic — a meta description, an excerpt sent
somewhere else — it is three lines in a `@derived`, and that is logic rather than
presentation.

### Line breaks in user text

`{{ comment|linebreaks }}` has no Svelthon helper, and the reason is worth a
section: **both answers here produce no HTML at all**, so the escaping problem
Django's filter exists to solve does not arise. A Flask project has the problem
in its sharpest form, since Jinja offers nothing: the usual answer is
`{{ comment|replace("\n", "<br>")|safe }}`, which turns autoescaping off on
user-typed text, exactly the trade Django's filter was written to avoid.

The case is real — a comment or a bio typed into a `<textarea>` arrives with
newlines, and HTML collapses them. Two ways out, depending on what you want:

```svelte
<!-- keep the line breaks as they were typed -->
<p class="comment">{comment}</p>

<!-- or real paragraphs -->
{#each comment.split("\n\n") as para}
    <p>{para}</p>
{/each}

<style>
    .comment { white-space: pre-wrap }
</style>
```

The second renders `<p>Première ligne.</p><p>Nouveau paragraphe &lt;b&gt;…</p>` —
proper elements, escaping done by Svelte, and not a single `{@html}`. Django's
filter has to escape first and then insert tags precisely because it builds HTML
from a string; here nothing builds HTML, so there is nothing to get wrong.

**Jinja has no `linebreaks` either**, which is the tell. Its template language can
call a method with an argument, so `{{ comment.split("\n\n") }}` was always
available and the filter never had a reason to exist. Django's cannot —
`{{ comment.split }}` calls `split()` with no argument — so it needed one.

That is the rule behind this whole page, and it is worth stating once: *a template
needs a filter when its host cannot do the job in an expression*. Django's extra
filters answer a weak expression language. Jinja's 54 answer what no Python
expression does in one go — regex work, chunking, serialising, wrapping. Ours
answer a third constraint, which is that a component ships to a browser and takes
its batteries from the platform rather than from an import — and that is why
`batch` and `tojson` echo Jinja's list while `date`, `timesince` and `slugify`
echo Django's.

### Slugs

`{{ title|slugify }}` keeps its word, and loses its option. Bare Jinja has no
slug filter, and Flask has none either: a project installs `python-slugify` or
writes the regex by hand, which is where its variants come from.

```svelte
<h2 id={slugify(pep.title)}>{pep.title}</h2>
<a href="/pep/{pep.number}-{slugify(pep.title)}">…</a>
```

One rule: compose, lowercase, keep every letter, digit and mark, turn everything
else into a dash. Punctuation and runs of spaces collapse the way Django's do,
and an underscore survives as it does there.

Where it parts company is the letters themselves:

| | Django | Svelthon |
|---|---|---|
| `Été à Paris` | `ete-a-paris` | `été-à-paris` |
| `Straße` | `strae` | `straße` |
| `Łódź` | `odz` | `łódź` |
| `Tiếng Việt` | `tieng-viet` | `tiếng-việt` |
| `Đường Đồng Khởi` | `uong-ong-khoi` | `đường-đồng-khởi` |
| `हिन्दी भाषा` | `""` | `हिन्दी-भाषा` |
| `Привет мир` | `""` | `привет-мир` |
| `日本語` | `""` | `日本語` |

Django folds what folds to ASCII and drops the rest, which needs
`allow_unicode=True` to stop being destructive — and its default is a silent
failure rather than an edge case, since a site written in Russian or Japanese
gets the *same empty slug for every article*.

A URL has carried unicode for years: a browser shows `wiki/Привет` decoded and
encodes it on the wire. Once that is granted, folding `é` while keeping `本` has
no reading that holds together — so the accents stay too, and there is no option
to turn on.

The Vietnamese row is the one to look at twice. `Đ` is a **letter** of that
alphabet, not a D wearing an accent, so it does not decompose and Django does not
fold it — it deletes it. A street named Đồng Khởi comes out as `ong-khoi`, and
`đ` is a common consonant, so it happens in every other word.

Two details make the rule work rather than merely look right. It composes first
(NFC), because `é` written as one code point and as `e` plus a combining acute
look identical and must give **one** URL. And it keeps combining marks, which is
not decoration: a Devanagari vowel sign has no composed form, so dropping marks
turns `हिन्दी भाषा` into `ह-न-द-भ-ष-` — not a folded word, a shredded one.

### HTML shown as text

`{{ body|striptags }}` keeps its word and changes its engine — the browser's own
parser, not a regular expression:

```svelte
<p class="excerpt">{striptags(entry.summary)}</p>
```

The case is content nobody here wrote: a feed, an API answer, an imported
document. For your own pages you already hold the plain text.

**The regex both Django and Jinja ship is not merely imprecise, it is wrong on
ordinary input** — measured:

| | regex | Svelthon |
|---|---|---|
| `<p>caf&eacute; &amp; th&eacute;</p>` | `caf&eacute; &amp; th&eacute;` | `café & thé` |
| `<img alt="a>b" src="x"> suite` | `b" src="x"> suite` | `suite` |
| `<script>alert("x")</script> après` | `alert("x") après` | `après` |
| `<p>a &lt; b et 3 < 4</p>` | `a &lt; b et 3 ` | `a < b et 3 < 4` |

Entities left undecoded, markup escaping through an attribute that holds a `>`,
and the source of a `<script>` landing in the excerpt. Django's own documentation
warns that the output is not safe; what the table shows is that it is not even
right.

Whitespace is collapsed as Jinja does, and no separator is invented between
blocks — `<p>a</p><p>b</p>` gives `ab` there too.

**Off a browser it returns nothing.** There is no parser under Node, and no
fallback either: a first render shows less and then shows the text, rather than
showing `caf&eacute;` and correcting it after hydration. A page that needs the
text on the server should strip it where the data is prepared, not where it is
displayed.

### Encoding a value into a URL

`{{ tag|urlencode }}` keeps its word — Liquid, Django and Jinja all spell it that
way — and takes Jinja's shape, a value or a mapping:

```svelte
<a href="/search?{urlencode({"q": query, "page": n})}">…</a>
<a href="/tag/{urlencode(tag)}">…</a>
```

There is no `urldecode`, and that is not an omission. Encoding is what a template
does; decoding is what happens *before* one. Django and Jinja have no decoder
either — only Liquid, because a Shopify theme is data and a template with no code
in front of it. Here SvelteKit has already decoded: `page.url.searchParams.get("q")`
hands back the plain value.

**One deliberate difference.** Django and Jinja both leave `/` unquoted in the
string form, so `/tag/{urlencode(tag)}` on a tag of `a/b` yields `/tag/a/b` —
two path segments where one was meant. Jinja gives a reason for it, that HTTP
servers treat `/` and `%2F` alike in paths, and the reason does not hold: Apache
answers 404 on an encoded slash unless `AllowEncodedSlashes` is on, nginx decodes
it, and the two differ by design.

Jinja does not agree with itself either — `|urlencode("a/b")` gives `a/b` while
`|urlencode({"p": "a/b"})` gives `p=a%2Fb`, the two forms reaching different
helpers. Taking its shape therefore meant choosing one of its two answers;
escaping in both is the only reading that holds together.

The cost is a query string that reads `?path=%2Fa%2Fb` instead of `?path=/a/b`.
The gain is a path segment that stays one segment.

### URLs — an honest regression

`{% url 'pep' pep.number %}` in Django, `{{ url_for('pep', number=…) }}` in
Flask: both resolve a *named* route, so renaming a URL does not break templates.
SvelteKit has no named routes: you write `/pep/{pep.number}`, and renaming the
directory means grepping for the path.

This is the thing you will miss, and more so coming from Flask, where `url_for`
is the ordinary way to write any link rather than one helper among many.

### CSRF

`{% csrf_token %}` in Django, `{{ form.csrf_token }}` under Flask-WTF: neither
has an equivalent, because SvelteKit does not use a token. It compares the
request's `Origin` to the app's own and refuses a cross-site form post. Nothing
to write in the form — but the origin must be right, or every POST comes back
`403`. See `paths.origin` in the SvelteKit configuration.

## What Svelte adds, and neither of them needed

A Django or Jinja template renders once, to a string, and the page is done. A
Svelthon template also renders on the server — but then keeps running in the browser, and
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
