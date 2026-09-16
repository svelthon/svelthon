<script lang="python">
# The same object in the same position as KeyMember.svelte, put there *after*
# the watch began. The initial walk hands the watch to both halves of an entry;
# an insertion has to keep that invariant rather than restate half of it.
class Box:
    def __init__(self):
        self.value = 0


items = {}


def add():
    items[Box()] = "label"


def bump():
    for item in items:
        item.value += 1


def total():
    return sum(item.value for item in items)
</script>

<button data-k="add" onclick={add}>add</button>
<button data-k="bump" onclick={bump}>bump</button>
<p data-k="total">{total()}</p>
