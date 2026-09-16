<script lang="python">
class Box:
    # `later` is never assigned: an uninitialised slot has no storage at all, and
    # asking the class for its names rather than the object for its values would
    # raise here, at mount.
    __slots__ = ("rows", "index", "later")

    def __init__(self):
        self.rows = []
        self.index = {}


class Wide(Box):
    # Declares none of its own, so every slot below is inherited.
    __slots__ = ()


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
