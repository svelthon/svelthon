# Directives keep the host language

*Open. Nothing has been decided; this note records what is true today, what it
costs, and what changing it would involve.*

## What happens

A directive's value is handed to Svelte untouched, as JavaScript. Everything else
in the markup — text interpolations, attribute values, block iterables, keys,
`{@const}`, `{@html}` — is compiled as Python.

```svelte
<button onclick={toggle}>            <!-- works -->
<button onclick={lambda: choose(x)}> <!-- does not compile -->
<p class:many={flag}>                <!-- works -->
<p class:many={len(items) > 2}>      <!-- does not compile -->
<p style:color={"red" if flag else "blue"}>   <!-- does not compile -->
```

The rule lives in one regular expression in `src/lib/svelthon.js`:

```js
const DIRECTIVE = /^(?:on[a-z]|(?:on|use|bind|transition|animate|in|out|class|style):)/;
```

The failures above are JavaScript parse errors, raised by Svelte's own parser
after our preprocessor has left the expression alone — so the message names a
token, not the seam.

## Why the bare names work

`onclick={toggle}` and `class:many={flag}` are not exceptions to the rule; they
are Python that happens to be valid JavaScript *and* to name something the
generated component declares. `compile.cjs` emits a JavaScript `const` for every
exported Python function — the wrapper that trims arity, converts arguments and
converts the return — and a `let` for every state name. So a bare identifier
resolves. An expression does not.

That is why the seam is invisible until the day you write a per-item handler in a
loop, which is exactly where it was found.

## The list splits in two

**Genuinely JavaScript, and should stay:**

- `bind:value={name}` needs an *assignable reference*, not an expression.
  Compiling it to a call would break the write-back half of the binding.
- `use:action={options}` — the action is a JavaScript function Svelte calls with
  the node.
- `transition:`, `in:`, `out:`, `animate:` — same, plus an options object.

**Ordinary values, which could be Python:**

- `class:name={…}` and `style:prop={…}` take a value, evaluated for truthiness or
  stringified. There is no reason it must be JavaScript.
- `on*={…}` takes a *callable*. Python's is `lambda`, and the boundary that makes
  a Python callable safe for JavaScript already exists: `pyHandler` in
  `runtime.js` reads the signature from Brython's `$function_infos`, trims the
  arity and converts the arguments. It was written for remote functions.

## The cost of leaving it

A Python component contains JavaScript:

```svelte
<button onclick={() => choose(one)}>{one}</button>
```

That is the documented workaround, used by `tests/fixtures/Events.svelte` since
the beginning and by the DaisyUI page in the demo. It works, and it contradicts
the project's own rule that a `.py` should behave like a `.ts` — a TypeScript
component does not contain a second language.

## What changing it would involve

Move `on*`, `class:` and `style:` out of `DIRECTIVE` so their values compile as
Python expressions, then wrap what an `on*` yields in `pyHandler` before handing
it to Svelte. `onclick={toggle}` keeps working: the compiled expression returns
the same wrapper it returns today.

Two things to check rather than assume:

- Svelte's parser reads a directive value as an expression at *parse* time; the
  compiled form `__expr_0(follow(one))` is a call expression, which is fine
  syntactically, but `class:` and `style:` are also read by the CSS pruning pass.
- An `on*` value is compared by identity when Svelte updates an element. A
  wrapper built fresh on every read would detach and reattach the listener on
  every render, exactly as `jsCall` would have done before it was memoised.

`bind:` stays as it is, and that asymmetry then needs saying in the README: three
directives out of eight are Python, five are not.
