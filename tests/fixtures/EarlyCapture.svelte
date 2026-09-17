<script lang="python">
# The mutator is taken off the list inside the factory, before the list has a
# module-level name and therefore before anything watches it.
def make():
    values = []
    add = values.append

    return values, add


pair = make()
rows = pair[0]
add = pair[1]


def go():
    add(1)


def total():
    return len(rows)
</script>

<button data-k="go" onclick={go}>go</button>
<p data-k="total">{total()}</p>
