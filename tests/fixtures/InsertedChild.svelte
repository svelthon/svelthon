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

    class Fresh:
        # Re-iterable, and not an iterator: it has no `__next__`, and still
        # keeps nothing of what it yields.
        def __init__(self, source):
            self.source = source

        def __iter__(self):
            return self.source()

    def install():
        nonlocal rows

        if how == "extend":
            rows.extend(items())
        elif how == "augment":
            rows += items()
        elif how == "update":
            table.update(pairs())
        elif how == "extend-iterable":
            rows.extend(Fresh(items))
        elif how == "augment-iterable":
            rows += Fresh(items)
        elif how == "update-iterable":
            table.update(Fresh(pairs))
        elif how == "setdefault":
            # The one mutator that hands a child back instead of taking one: the
            # value it returns is what the program keeps and mutates, and it is
            # not among the arguments.
            table.setdefault("a", child)
        elif how == "append":
            rows.append(child)
        else:
            rows += [child]

    holder = table if how in ("update", "update-iterable", "setdefault") else rows

    return [holder, install, lambda: child.append(1)]


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
