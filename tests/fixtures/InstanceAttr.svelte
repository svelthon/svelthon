<script lang="python">
# The witness: an ordinary class, the attribute written in __init__, which is
# the shape the initial walk was built for.
class Box:
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
