<script lang="python">
# One Python callback through every position a JavaScript child can receive it
# by, and a library call beside them; a callback prop that writes; an
# attachment whose expression re-runs while naming the same function.
importjs CallbackPositionsChild from "./CallbackPositionsChild.svelte"
importjs { register } from "./callback_registry.js"


def square(value):
    return value * value


registry = register(square)
count = 0
flag = False


# Counted on the node and not in Python state: an attachment runs in an effect,
# and one that reads and writes the same state loops, in Svelte as here.
def bump(node, name):
    node.setAttribute(name, str(int(node.getAttribute(name) or 0) + 1))


def install(node):
    bump(node, "data-installs")
    return lambda: bump(node, "data-cleanups")


def other(node):
    pass


def flip():
    global flag
    flag = not flag
</script>

<CallbackPositionsChild
    direct={square}
    again={square}
    config={{"cb": square}}
    onpick={square}
    {**{"spread": square}}
    onchange={lambda v: (count := v)}
    {registry}
/>
<p data-k="count">{count}</p>

<button data-k="flip" onclick={flip}>flip</button>
<p data-k="attached" {@attach install if flag or True else other}>x</p>
