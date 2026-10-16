<script lang="python">
# Names the generated code reached JavaScript's globals by, bound by the script
# as any Python name: `Object` and `Symbol` stopped the component loading,
# `globalThis` made `js` the author's value, and `Infinity` the arity of a
# function taking `*args`, which a handler is called with.
from global_names import Object as Imported

Object = 1
Symbol = 2
globalThis = 3
Infinity = 0
NaN = 5
label: str = "prop"
calls = []


def gather(*args):
    calls.append(len(args))
</script>

<p>{Object + Symbol + globalThis + Infinity + NaN + Imported}</p>
<output>{js.Math.max(1, 2)}</output>
<button onclick={gather}>gather</button>
<span>{calls}</span>
