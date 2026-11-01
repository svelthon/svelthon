<script lang="python">
# The logger of `inspect_with` made by a call and the value it watches read by
# another, each noting its turn outside the component, since Svelte forbids
# writing to state from inside `$inspect`.
count = 0


def made(kind, *values):
    js.globalThis.__order.push("logged")


def factory():
    js.globalThis.__order.push("logger")
    return made


def watched():
    js.globalThis.__order.push("value")
    return count


inspect_with(factory(), watched())
</script>

<p>{count}</p>
