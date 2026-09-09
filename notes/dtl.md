# `foo.dtl.svelte`, if it ever happens

Design note, 2026-09-09. Nothing is committed and nothing is written. This
records how it would be built, so that reopening the question costs a read rather
than a rediscovery.

Background: block syntax over Svelte's was written, tried and ruled out on
2026-08-20 for three reasons, kept in `DJANGO.md` under *"Why the blocks are
Svelte's and not Django's"*. Two things changed on 2026-09-09.

**One of the three reasons expired**, and Florent is the one who expired it: *"if
Svelthon is a big success, the v2 would have a community behind it for support
and documentation"*. Reason 1 said Svelte's documentation is the asset a second
syntax would spend. That describes a **borrowed** asset, and a community replaces
the loan. It was contingent, not permanent, and it is his own design criterion
applied: integration with the host matters until divergence becomes the killer
feature.

**And the target moved from Django to Jinja**, which is the substantial change.
Django mixes a template engine with a framework: `{% url %}`, `{% csrf_token %}`,
`{% static %}`, loaders and context processors are coupling, not syntax. That is
why `DJANGO.md` had to write a section called *"URLs, an honest regression"* and
one on CSRF. Against Jinja those sections do not arise, and the audience is wider:
Flask, but also Ansible, Salt, MkDocs, Home Assistant.

## What the move to Jinja changed, measured

Reason 3 said a faithful translation runs out within three constructs. That was
counted against **Django**. Block keywords read out of Jinja 3.1.6's own parser:

```
autoescape  block  extends  for  from  if  import  include  macro  print  set  with
```

- **`macro` is `{#snippet}` plus `{@render}`**: a named, parameterised chunk
  called like a function. Confirmed by rendering one.
- **`set` is `{@const}`.**

Django has neither. So the "no `{#snippet}`" example does not hold any more.

What still has to be invented, and this does not move: the **loop key**,
`{#await}`, events, bindings, transitions. Jinja has no key and no async, because
it renders text once.

## Not Jinja, and not a modified Jinja

**The practical obstacle.** Jinja is a Python package and the build runs under
Node. Requiring CPython in the build chain breaks the positioning: `npm install
&& npm run dev` has to be enough. Running Jinja under Brython at build time pulls
the whole standard library back, the 2 869 kB cliff that was deliberately
removed.

**The real obstacle.** We want Jinja's **block grammar** and not its **expression
grammar**, and a parser hands over both. Nunjucks, which presents itself as a
port of Jinja2 to JavaScript, has the same problem: it would parse `{{ x }}` with
Jinja's semantics.

Stage 1 of Svelthon, which took the longest, says that what sits between the
delimiters is **Python**. Going through any Jinja parser would undo it.

## So: a transliteration, not a parser

A pass that converts the block skeleton and **never looks inside an expression**.
It runs before the existing markup pass, which then does its usual work without
knowing the file was written with `{% %}`.

```
{% if x %}          →  {#if x}
{% elif x %}        →  {:else if x}
{% else %}          →  {:else}
{% endif %}         →  {/if}
{% for x in xs %}   →  {#each xs as x}
{% endfor %}        →  {/each}
{% set a = b %}     →  {@const a = b}
{% macro f(a) %}    →  {#snippet f(a)}
{% endmacro %}      →  {/snippet}
{{ expr }}          →  {expr}
```

Everything else is untouched: attributes, `onclick={}`, `bind:`, `{#await}`.
Blocks from Jinja for **structure**, attributes from Svelte for **behaviour**,
which is the split Vue got backwards. A scanner over `{% … %}` tracking quote
state, in the shape `markup.js` already has. Estimated at 150 to 200 lines with
the refusals.

**Where it plugs in, and this is a merit of the extension Florent chose.**
`foo.dtl.svelte` ends in `.svelte`, so `vite-plugin-svelte` claims it and the
preprocessor's `markup()` hook is called on it. The transliteration is a branch in
a hook that already exists, keyed on the filename. No new plugin, no resolution,
no virtual module.

## What it refuses out loud

`{% extends %}`, `{% block %}`, `{% include %}`. Those are template inheritance,
which Svelte answers with components and slots. A refusal naming the line and
saying what to write instead, never an approximate translation.

## Two inventions, both small

**The loop key**, since Jinja has none: `{% for x in xs key x.id %}` becomes
`{#each xs as x (x.id)}`. That is what the discarded `dtl.js` had already invented
in August.

**`loop.index`**, which has to become the second name of `{#each xs as x, i}`.

## The one real conflict: the pipe

`{{ x|slugify }}` is what makes a template *look* like Jinja, and it is exactly
where the two goals collide: `|` is Python's bitwise or, so `flags|MASK` is valid
Python meaning something else.

Three ways out, none of them neutral:

1. **No pipe**: `{{ slugify(x) }}`. Consistent with "expressions are Python", and
   most of the recognition effect is lost.
2. **Rewrite `a|b|c` to `c(b(a))`** before Python sees it. Breaks `flags|MASK`,
   silently, which is the failure mode this project refuses everywhere else.
3. **Rewrite only when the right-hand name is a known filter.** Works for the
   fifteen injected ones, becomes ambiguous the day an author names a variable
   like a filter.

Everything else about the block skeleton is free. The pipe is the only place it
costs something, and it is a design call, not an implementation one.

## What would settle whether to do it at all

One measurement, and it separates recognition from compatibility: take a real
Jinja template out of a Flask application and count **how much compiles
untouched**. High, and there is a killer feature. Low, and it is a synonym.

Not done.

## Naming, decided by Florent

**`foo.dtl.svelte`, prefix and not suffix.** `foo.svelte.dtl` would read as a
*module*: Svelte's own convention makes `foo.svelte.ts` a module and `foo.svelte`
a component, a grid Svelthon already teaches with `foo.svelte.py`. In base
position `.svelte` announces the component; the infix qualifies how the markup is
written, exactly as `lang=` qualifies the script.

**`.dtl` and not `.jinja`.** `.jinja` is a promise of exact compatibility
(`loop.index`, `{% extends %}`, filters, whitespace control) that would not be
kept. `.dtl` promises a family resemblance. On a name, **under-promising is the
right error.**

The asymmetry that settles it: read as Django, `.dtl` disappoints **loudly**,
since nobody wonders for long why a client component has no `{% csrf_token %}`.
Read as Jinja, `.jinja` disappoints **silently**, because `loop.index` is a
reasonable expectation that would simply not work. And `.j2` and `.jinja` are
heavily claimed by tooling; `.dtl` is free.

What would ship is neither one: **Svelte's semantics with a `{% %}` skin.** A
family name is more honest than any implementation name.
