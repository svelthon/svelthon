<script lang="python">
# A list subclass carries instance attributes beside its elements: the object is
# a JavaScript array *and* has an instance dict. Nothing of the list protocol is
# redefined here — the attribute is the whole difference.
class Box(list):
    def __init__(self):
        self.rows = []


box = Box()


def go():
    box.rows.append(1)


def total():
    return len(box.rows)
</script>

<button data-k="go" onclick={go}>go</button>
<p data-k="total">{total()}</p>
