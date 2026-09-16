<script lang="python">
# A list subclass holding an attribute, mutated through an alias kept in a
# closure: nothing ever reads `box.rows` again, so the handover that happens at
# read time cannot cover this one. The initial walk is the only route.
class Box(list):
    def __init__(self, rows):
        self.rows = rows


def make():
    rows = []
    box = Box(rows)

    def change():
        rows.append(1)

    return box, change


pair = make()
box = pair[0]
change = pair[1]


def total(target):
    return len(vars(target)["rows"])
</script>

<button data-k="go" onclick={change}>go</button>
<p data-k="total">{total(box)}</p>
