<script lang="python">
def make():
    # The child and the container both live in a closure, so the only route from
    # the page to the child is *through* the container: nothing else can hand it
    # the watch, and `{holder}` is the one thing that renders it.
    child = []
    rows = []
    table = {}

    def items():
        # A generator, which is the whole point of the first two shapes: it
        # hands the child over and keeps nothing, so watching *it* watches
        # nothing at all.
        yield child

    def pairs():
        yield ("a", child)

    def install():
        nonlocal rows

        if how == "extend":
            rows.extend(items())
        elif how == "augment":
            rows += items()
        elif how == "update":
            table.update(pairs())
        elif how == "append":
            rows.append(child)
        else:
            rows += [child]

    return [table if how == "update" else rows, install, lambda: child.append(1)]


how: str = "extend"
made = make()
holder = made[0]
install = made[1]
grow = made[2]


@export
def snapshot():
    # What Python holds, read without going through the page at all.
    return str(holder)
</script>

<button data-k="install" onclick={install}>install</button>
<button data-k="grow" onclick={grow}>grow</button>
<p data-k="rows">{holder}</p>
