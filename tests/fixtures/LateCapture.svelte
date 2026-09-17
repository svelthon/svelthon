<script lang="python">
# The witness: the same method taken off the same kind of list, after the
# module-level assignment that makes it reactive.
rows = []
add = rows.append


def go():
    add(1)


def total():
    return len(rows)
</script>

<button data-k="go" onclick={go}>go</button>
<p data-k="total">{total()}</p>
