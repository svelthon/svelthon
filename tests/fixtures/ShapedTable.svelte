<script lang="python">
# Two more shapes of table, each updated once per row: a grid keyed by tuples,
# and a set of instances.
class Cell:
    def __init__(self):
        self.read = False


kind: str = "grid"
side: int = 100
cells = {(row, col): Cell() for row in range(side) for col in range(side)} if kind == "grid" else {Cell() for i in range(side * side)}


def mark_all():
    for cell in (cells.values() if kind == "grid" else cells):
        cell.read = True


def count():
    return sum(1 for cell in (cells.values() if kind == "grid" else cells) if cell.read)
</script>

<button onclick={mark_all}>mark all</button>
<p>{count()}</p>
