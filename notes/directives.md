# Directives take Python

*Closed, but for one line that belongs to Svelte and one question that belongs to
the project.*

## Where it stands

Every directive's value is compiled as Python, like every other expression in a
template. What used to be the seam — a Python component containing a JavaScript
arrow — is gone:

```svelte
<button onclick={lambda: choose(one)}>{one}</button>
<p class:many={len(items) > 2}>
<p style:color={"red" if flag else "blue"}>
<div use:action={{"delay": 200}}>
<div transition:fly={{"y": 20}}>
<input bind:value={row["label"]}>
```

Four mechanisms, not one, because the directives do not all take the same kind of
thing.

**A handler takes a callable.** `on*` compiles as Python and what the expression
yields is wrapped for JavaScript by `pyEvent`, which reads the signature Brython
recorded in `$function_infos`, trims the call to the declared arity and converts
the arguments. That is what lets `lambda: choose(pep)` ignore the DOM event it is
handed while `lambda e: read(e.target.value)` receives it. The wrapper is named
`__event` in the markup pass and emitted by the compiler, which is what carries
the component's line offset — the markup pass runs too early to know it.

**A handler that assigns takes the walrus.** `onclick={() => (open = !open)}` has
no short Python twin — a `lambda` holds an expression, `open = not open` is a
statement — and `(open := not open)` is the only assignment Python allows inside
an expression. Its own meaning is useless here: PEP 572 binds in the enclosing
function, a lambda is one, so the write dies with the call, silently. Measured
before it was changed: the click ran, the value did not move, nothing was
reported.

So the markup pass rewrites a parenthesised walrus into `__assign("name", value)`
— pure string work, in `markup.js`, because `py2js` hands back a *copy* of the
AST and mutating it changes nothing in the generated code (measured too).
`__assign` writes through the namespace, so through the accessor, so the signal
fires. Handlers only: a render must not write state, and Svelte rejects it.

`f(x := 1)` keeps Python's meaning — a temporary the call consumes — because the
rewrite requires the parentheses Python's own grammar forces in a lambda.

**`class:` takes a truth value**, so it goes through `__truthy`: an empty list is
false here and true in JavaScript, exactly as in `{#if}`. `style:` takes a value
and is stringified like any other.

**`use:` and the transition family name their function in the directive**, never
in the value — `use:action={options}`, `transition:fly={options}`. So the value
is an ordinary options object, and a Brython dict already exposes its keys as
JavaScript properties. There was nothing in the way.

**`bind:` reads and writes**, which no single expression does. Svelte takes a
pair for exactly that — `bind:value={() => v, (n) => v = n}`, since 5.9 — so the
value is compiled twice: once as an expression, once as an assignment target. A
bare name barely notices, being the same word in both languages; what it buys is
`bind:value={row.label}`, which used to be a JavaScript member expression and
silently missed a dict.

The setter is generated, not written, so Python's one-expression rule for
`lambda` does not apply to it: the compiler emits a `def`, with a `global` when
the target is a module name — otherwise the assignment would land in a frame
nobody reads.

## The one exception

`bind:group` refuses the pair:

```
`bind:group` can only bind to an Identifier or MemberExpression
```

So it keeps its text. A bare name works there, because a name is written the same
way in both languages; `bind:group={obj.field}` is JavaScript's member expression
and misses a dict, as all of them used to.

## The one open question

A template expression's dot finds a key as well as an attribute, and the write
has to land where the read came from — otherwise `bind:value={sizes.width}` reads
the key and writes a JavaScript property onto the dict: no error, no effect, and
the field snaps back on the next render. That was measured, not assumed.

`inTemplate` therefore swaps `$B.$setattr1` alongside `$B.$getattr_pep657`, and
redirects the write to the item **only where the read already succeeded** — an
existing key.

What a *missing* key should do is undecided, and deliberately so: creating one on
write is a real choice, and Jinja has no opinion to lend us since it never
writes. Until then it keeps Python's own answer.
