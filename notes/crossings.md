# The boundary, one table

Thirteen of the runtime's twenty-six exports exist to move a value between Python
and JavaScript. Each is justified where it is defined; what was missing is the
one page that says **which door to use**, so that the answer stops being folklore
held by whoever last worked on it.

The cost of not having it is measured: `pyEvent` guarded on
`Array.isArray($function_infos)`, a shape Brython's interop wrapper satisfies
while carrying no arity, so `onclick={helpers.click}` called a zero-argument
`def` with the DOM event. Latent since handlers became Python, found on
2026-09-07 by writing the case down rather than by reading the code.

## Reading the table

**Direction** is where the value is going. **When** is what triggers the
crossing. A converter appears once: if two rows name the same one, they are the
same crossing seen from two places.

| direction | when | door | what it does |
|---|---|---|---|
| Python → JavaScript | a module or route function returns | `plainData` | walks containers and instances into plain JavaScript; a coroutine becomes a promise; `__dict__` fields only, never a `@property` |
| Python → JavaScript | a template expression returns to a directive or an attribute | `pyNumbers` | shallow: unboxes floats and wraps callbacks so a `tick(0.5, …)` survives its first fractional frame |
| Python → JavaScript | a component function is read as a value | `pyEvent` / `pyHandler` | trims the call to the arity Python declared, converts the arguments, names the file in any error |
| Python → JavaScript | a value is written to a DOM attribute or a `bind:` | `__brycomp_pybridge.bound` | `None` becomes `undefined`, so Svelte drops the attribute instead of writing the word |
| Python → JavaScript | a dict is spread into props | `__brycomp_pybridge.spread` | a shallow copy, or Svelte diffs a mutated dict against itself and writes nothing |
| JavaScript → Python | a framework event reaches `load`, an action, `+server.py` | `pyArg` | a real dict with `params`, `query`, `url`, `method`, `route`, plus `js` for the rest |
| JavaScript → Python | anything else the framework hands over | `pyData` | `jsobj2pyobj`, then `to_dict` when there is one — idempotent, so a value that never left comes back unchanged |
| JavaScript → Python | a JSON string | `from_json` | `pyData` with the parse attached |
| JavaScript → Python | an argument reaching a Python callback from JavaScript | `inbound` | `jsobj2pyobj` on each, so a number arrives as a number and not as a BigInt candidate |
| both ways | Python calls a JavaScript function it imported | `jsCall` | converts arguments in depth going out, and the result coming back |
| both ways | JavaScript calls a Python function of a module | `pyBoundary` | undoes the conversion Brython's interop applied on the way in, using the back-reference map |
| neither | a value read for its signature | `declared` | reads the arity of a function, a bound method or an instance's `__call__`; a builtin or a slot Python calls has none to trim to, and takes every argument; anything not callable answers `null` |

## The two rules that decide most cases

**Who is calling.** If JavaScript is about to call Python, the door trims the
call and converts the arguments — `pyEvent`, `pyHandler`, `pyBoundary`. If Python is about to call JavaScript, the door converts what it
hands over — `jsCall`, `plainData`.

**How deep it must go.** `plainData` walks; `pyNumbers` does not. The shallow one
is for a value the framework reads immediately — a transition config, an
attribute — where a deep walk would copy an object Svelte compares by identity.
The deep one is for a value leaving the process: a `load()` result, a response
body.

## Where a wrong door shows

Three failures, all seen for real, each naming its door:

```
0.5 cannot be converted to a BigInt      pyNumbers missing: a float crossed as an object
'Javascript Object' has no attribute get  pyData missing: a dict arrived as a JS object
bump() takes 0 positional arguments       declared missing: arity read off the wrong wrapper
```

Their shape is always the same. The value crosses, nothing complains, and the
failure appears one call later in a place that has nothing to do with the
boundary.
