<script lang="python">
def make():
    # The child the loop renders, held in a closure: the mutation below reaches
    # it by the name it was created under and never through the container, so
    # nothing can attach the watch on the way in. In every shape but the last,
    # the container the loop is given never holds it — the iterator is the only
    # thing that yields it.
    child = []

    class Yields(list):
        def __iter__(self):
            return iter([child])

    class Composed:
        # A collection by composition, with no list above it: the ordinary way
        # to write one, and the shape that took the array branch's repair and
        # got nothing.
        def __iter__(self):
            return iter([child])

    class Stores(Composed):
        # The witness that isolates the gap: the same class, and the child is
        # also reachable in its storage, so the initial walk finds it.
        def __init__(self):
            self.child = child

    sources = {
        "subclass": Yields,
        "composed": Composed,
        "stored": Stores,
        "list": lambda: [child],
    }

    return [sources[shape](), lambda: child.append(1)]


shape: str = "composed"
made = make()
rows = made[0]
grow = made[1]
</script>

<button onclick={grow}>grow</button>
{#each rows as row}<p data-k="size">{len(row)}</p>{/each}
