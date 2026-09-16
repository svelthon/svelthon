<script lang="python">
# The witness for SetMember.svelte, and the only difference is that the set is
# named: `Bag(set)` redefines nothing.
class Box:
    def __init__(self):
        self.value = 0


class Bag(set):
    pass


items = Bag([Box()])


def bump():
    for item in items:
        item.value += 1


def total():
    return sum(item.value for item in items)
</script>

<button data-k="bump" onclick={bump}>bump</button>
<p data-k="total">{total()}</p>
