<script lang="python">
# Rows a block filters by an attribute of each of its instances, computed
# again on a row added, and the same filter called from JavaScript, outside
# any reaction. The rows kept are the few added, so computing them is what
# the block costs.
n: int = 2000


class Box:
    def __init__(self, n):
        self.n = n


boxes = [Box(i) for i in range(n)]


def rows():
    return [b for b in boxes if b.n < 0]


@export
def work():
    return len(rows())


@export
def add():
    boxes.append(Box(-1))
</script>

{#each rows() as box}<i>{box.n}</i>{/each}
