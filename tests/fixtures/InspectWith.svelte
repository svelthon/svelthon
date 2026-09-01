<script lang="python">
# `inspect_with` is `$inspect(…).with(fn)` with the callable in front. The
# callback is handed the kind — "init" or "update" — and then the values.
#
# It records outside the component, because Svelte forbids writing to state from
# inside `$inspect`, exactly as it does from a `$derived` — which is the right
# rule and the reason a logger logs somewhere else.
count = 0
message = "hello"


def record(kind, *values):
    js.globalThis.__inspected.push("{}:{}".format(kind, ",".join(str(v) for v in values)))


def trim(kind):
    # Two arguments arrive where one parameter is declared: the boundary trims
    # the call to the arity Python declared, exactly as it does for a handler.
    js.globalThis.__inspected.push("trimmed:" + kind)


inspect_with(record, count, message)
inspect_with(trim, count)


def bump():
    global count
    count += 1
</script>

<button onclick={bump}>bump</button>
