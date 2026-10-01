<script lang="python">
# A list subclass with a slot. Brython keeps it as an array, its elements at the
# indices and its slot beside them. The methods read the slot through
# `object.__getattribute__`, so no ordinary attribute read hands it the watch:
# only the initial walk can.
def reveal(value):
    return object.__getattribute__(value, "rows")


class Rows(list):
    __slots__ = ("rows",)

    def __init__(self):
        self.rows = []

    def __len__(self):
        return len(reveal(self))

    def grow(self):
        reveal(self).append(1)


box = Rows()


def bump():
    box.grow()
</script>

<button data-k="bump" onclick={bump}>bump</button>
<p data-k="rows">{len(box)}</p>
