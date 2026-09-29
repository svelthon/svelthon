# What a template expression is compiled into

*Plumbing. The two rules an author has to know — the dot and the walrus — are in
the README; this is what sits under them.*

## One hidden function per expression

Every site the markup *reads* becomes a Python function appended to the
component's own module, and the markup calls it:

```svelte
{#if rows}
  {#each rows as r}<li data-id={r.id}>{r.label}</li>{/each}
{/if}
```

```python
def __expr_0(): return __truthy(rows)
def __expr_1(r): return r.id
def __expr_2(r): return __text(r.label)
```

Appended, never prepended, so the author's line numbers stay true — which is what
keeps error messages and source maps honest. A block's own names are parameters,
so a function reads the component's names through the namespace accessors and
Svelte discovers the dependencies by itself, exactly as it does for `@derived`.
The `{#each}` iterable is compiled *before* the block's scope is pushed and its
key *inside* it, because that is where each is evaluated.

## Five adapters, and why they are not exceptions

Svelte's engine was built for JavaScript values. Handed a Python one it reads it
as JavaScript, and the result is wrong in a way that has nothing to do with what
the author wrote. These five keep Python being Python — removing them makes the
template *less* faithful, not more.

| | Where | Without it |
|---|---|---|
| `__truthy` | `{#if}`, `{:else if}`, `class:`, and on an element the boolean attributes of HTML (`hidden`, `disabled`, `checked`…) | `{#if []}` is true, as it is in JavaScript, and `hidden={[]}` hides |
| `__class` | `class={…}` on an element | Svelte hands an object or an array to `clsx`, which keeps what JavaScript finds true and walks into `None`, writing `ob_type __doc__` as classes |
| `__spreadElement` | `{**attrs}` on an element | each key is read as the attribute it becomes: `class` by `__class`, a boolean attribute by `__truthy` |

Which wrapper an attribute takes is decided by its name, in one place
(`src/lib/attributes.js`), and every way of writing it asks there: `name={x}`,
the shorthand `{name}`, a lone interpolation between quotes, on a tag or on
`<svelte:element>`, and through a spread.
| `__text` | `{x}`, `{@html}`, `class="a {x}"` | `None` renders `[object Object]`, a list `1,2` instead of `[1, 2]` |
| `__seq` | the `{#each}` iterable | a dict, a `range`, a generator or `.items()` does not iterate at all — a list and a tuple do, being JavaScript arrays |
| `__spread` | `{...attrs}` | Svelte diffs against the previous render by identity, so a mutated dict looks unchanged |
| `__key` | `{#key x}` and an `{#each}` key | keys compare by identity: a list, a dict or an instance keeps one, a tuple or a float rebuilt does not, so those key by `repr()` |

They are not Python's own `bool()` and `str()`: a template may hold a foreign
JavaScript value — a DOM node from `bind:this` — on which Brython's classifier
trips. These fall back.

They are bound onto the namespace prototype like the injected names, but
**unguarded**: an author who shadowed one would silently take over every
interpolation in their own markup.

## The two that are not adapters

`inTemplate` swaps `$B.$getattr_pep657` and `$B.$setattr1` for the length of one
evaluation, so the dot finds a key — on the way in and on the way out. It probes
with a default (`$getattr(obj, attr, MISSING)`), so a miss costs no exception,
which is the whole cost of the feature. The write is redirected only where the
read already succeeded — an existing key; what a *missing* key should do is
undecided and keeps Python's answer.

`__assign` is what a parenthesised walrus becomes, in a handler only. The
rewrite is pure string work in `markup.js`, not an AST pass, because `py2js`
hands back a **copy** of the AST: mutating it changes nothing in the generated
code. The write goes through the namespace, so through the accessor, so the
signal fires.

## What directives compile to

`notes/directives.md` has the four mechanisms and the two things left over.
Briefly: a handler's value is wrapped by `pyEvent` so JavaScript can call a
Python callable with the arity it declared; `class:` goes through `__truthy`;
`use:` and the transition family name their function in the directive, so their
value is an ordinary options dict; `bind:` is compiled twice, as an expression
and as an assignment target, into the pair Svelte takes.

## What the markup pass must never touch

Only the markup, never a `<script>` or `<style>` body: Python is full of braces —
dict literals, f-strings — and rewriting them would be catastrophic. An HTML
comment is not a tag either, and quotes mean nothing inside one: `aujourd'hui`
once opened a string that never closed, leaving the whole rest of the template in
JavaScript, silently.
