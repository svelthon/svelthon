# Directives take Python

*Closed. One question is left, and it belongs to the project rather than to
Svelte.*

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

Five mechanisms, not one, because the directives do not all take the same kind of
thing.

**A handler takes a callable.** `on*` compiles as Python and what the expression
yields is wrapped for JavaScript by `pyEvent`, which reads the signature Brython
recorded in `$function_infos`, trims the call to the declared arity and converts
the arguments. That is what lets `lambda: choose(pep)` ignore the DOM event it is
handed while `lambda e: read(e.target.value)` receives it. The wrapper is named
`__brycomp_event` in the markup pass and emitted by the compiler, which is what carries
the component's line offset — the markup pass runs too early to know it.

**A handler that assigns takes the walrus.** `onclick={() => (open = !open)}` has
no short Python twin — a `lambda` holds an expression, `open = not open` is a
statement — and `(open := not open)` is the only assignment Python allows inside
an expression. Its own meaning is useless here: PEP 572 binds in the enclosing
function, a lambda is one, so the write dies with the call, silently. Measured
before it was changed: the click ran, the value did not move, nothing was
reported.

So the markup pass rewrites a parenthesised walrus into `__brycomp_assign("name", value)`
— pure string work, in `markup.js`, because `py2js` hands back a *copy* of the
AST and mutating it changes nothing in the generated code (measured too).
`__brycomp_assign` writes through the namespace, so through the accessor, so the signal
fires. Handlers only: a render must not write state, and Svelte rejects it.

`f(x := 1)` keeps Python's meaning — a temporary the call consumes — because the
rewrite requires the parentheses Python's own grammar forces in a lambda.

**`class:` takes a truth value**, so it goes through `__brycomp_truthy`: an empty list is
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

The value it receives crosses through `pyBind`, and that is the only conversion a
binding makes. Brython reads a JavaScript number as an `int` when it is whole and
as a **`JSObject`** when it is not, so `<input type="number">` — the one input
Svelte converts for you — wrote `0.42` into a name whose `type()` was `JSObject`.
It prints `0.42`, so the page looks right, and `round(x, 1)` raises. Numbers
alone: `bind:this` hands over a DOM node and `bind:files` a `FileList`, and those
cross as they are.

## The one that took a different shape

`bind:group` refuses the pair:

```
`bind:group` can only bind to an Identifier or MemberExpression
```

The refusal is structural rather than arbitrary: Svelte works out which inputs
form one group from the **identifiers of the expression**, statically, and two
anonymous functions have no text to compare. It is also the only binding where
several elements have to be recognised as aiming at one target.

So it does not become a pair — it becomes an **action**, and the pair rides along
as its parameter:

```svelte
bind:group={form.pick} value={n}
  →  use:__brycomp_group={[form["pick"], (v) => form["pick"] = v, n]}
```

Which removes the need for a group identity altogether: each input computes its
own `checked` from the same target, so exactly one radio stays filled and a row
of an `{#each}` keeps its own answer — something Svelte's static keypath cannot
express here, since two rows produce the same text.

**And that is what repairs it.** Svelte's own version writes with a plain
JavaScript assignment. It lands on the object — a dict's keys are ordinary
writable properties — but it never reaches `$B.$setitem`, which is where Svelthon
catches a mutation. Measured before the change: the value moved, nothing
re-rendered, and both radios stayed filled because the effect that unfills the
others never re-ran. An attribute of a class instance failed earlier still, being
invisible from JavaScript. Both work now, along with a checkbox group, which
arrives as a Python `list` rather than the `JavascriptArray` Svelte's version
assigned.

The `type` is read off the node. The **value cannot be**, and it is the one place
a directive here has to look at the attribute beside it. A DOM value is text, so
`value={5}` reads back as `"5"`: the group filled nothing at mount, and a
checkbox left `[1, '1']` behind — the same choice under two types. The typed
value is nowhere on the node either. Svelte keeps it on the hidden `__brycomp_value`
property, but only for an element it *sees* a group binding on, and this one
carries an action. So the markup pass reads the tag's own `value`, on either side
of the binding, and passes it as the third member. Only the braced spelling: a
quoted value is text, and the node's own is then exactly right.

The comparison is Python's `==`, not JavaScript's `===`, because a Brython float
is an object and two evaluations of `value={0.5}` are two of them.

Covered by `tests/groups.test.js` and `tests/group-values.test.js`.

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
