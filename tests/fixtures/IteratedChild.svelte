<script lang="python">
def make():
    # The child the loop renders, held in a closure: the mutation below reaches
    # it by the name it was created under and never through the list, so nothing
    # can attach the watch on the way in. With `custom`, the list it is rendered
    # from never holds it at all — the iterator is the only thing that yields it.
    child = []

    class Yields(list):
        def __iter__(self):
            return iter([child])

    return [Yields() if custom else [child], lambda: child.append(1)]


custom: bool = True
made = make()
rows = made[0]
grow = made[1]
</script>

<button onclick={grow}>grow</button>
{#each rows as row}<p data-k="size">{len(row)}</p>{/each}
