<script lang="python">
# A text that sorts the pairs of a dict, read again on a change inside one of
# its lists, and the same sort called from JavaScript, outside any reaction.
n: int = 500
d = {f"k{i:05}": [i] for i in range(n)}


def total():
    return len(sorted(d.items()))


@export
def work():
    return total()


@export
def grow():
    d["k00002"].append(1)
</script>

<p>{total()}</p>
