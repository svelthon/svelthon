<script lang="python">
# The witness for PartialAugment.svelte, and the only difference is the line
# inside `partial`: a method call rather than an augmented assignment, with the
# same generator and the same caught error.
rows = {}


def values():
    yield ("x", 1)
    raise ValueError("interrupted")


def partial():
    target = rows
    try:
        target.update(values())
    except ValueError:
        pass


def total():
    return len(rows)
</script>

<button data-k="partial" onclick={partial}>partial</button>
<p data-k="total">{total()}</p>
