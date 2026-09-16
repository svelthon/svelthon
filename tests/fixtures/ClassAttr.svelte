<script lang="python">
# The attribute lives on the class, deliberately shared, and is reached through
# the instance. The initial walk sees the instance and never the class, so it is
# the *read* that has to hand the watch over.
class Box:
    rows = []


box = Box()


def go():
    box.rows.append(1)


def total():
    return len(box.rows)
</script>

<button data-k="go" onclick={go}>go</button>
<p data-k="total">{total()}</p>
