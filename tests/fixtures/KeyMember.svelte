<script lang="python">
# The third position for the same object: not an element, a key. Hashable by
# identity, mutable in its attributes, and neither `__hash__` nor `__eq__` is
# redefined, so mutating it does not invalidate the entry.
class Box:
    def __init__(self):
        self.value = 0
        self.tags = []


items = {Box(): "label"}


def bump():
    for item in items:
        item.value += 1
        item.tags.append("x")


def total():
    return sum(item.value for item in items)


def tagged():
    return sum(len(item.tags) for item in items)
</script>

<button data-k="bump" onclick={bump}>bump</button>
<p data-k="total">{total()}</p>
<p data-k="tagged">{tagged()}</p>
