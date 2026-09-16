<script lang="python">
# The witness for SlotBox.svelte: the same component without the two `__slots__`
# lines, which is the whole difference.
class Box:
    def __init__(self):
        self.rows = []
        self.index = {}


class Wide(Box):
    pass


box = Wide()


def bump():
    box.rows.append(1)
    box.index["k"] = len(box.rows)


def rows():
    return len(box.rows)


def index():
    return len(box.index)
</script>

<button data-k="bump" onclick={bump}>bump</button>
<p data-k="rows">{rows()}</p>
<p data-k="index">{index()}</p>
