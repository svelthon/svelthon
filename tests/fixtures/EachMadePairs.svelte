<script lang="python">
# The pairs `.items()` and `enumerate()` make, handed on in a list the
# expression makes of them: sorted, listed, reversed. A list grows inside one
# row, which reaches the dict or the list the pairs were read from.
importjs { count } from "./counting.js"

kind: str = "sorted"

d = {f"k{i}": [i] for i in range(5)}
rows = [[i] for i in range(5)]


def pairs():
    if kind == "sorted":
        return sorted(d.items())
    if kind == "enumerated":
        return list(enumerate(rows))
    return reversed(list(d.items()))


def size(v):
    count("rows")
    return len(v)


def grow():
    d["k2"].append(1)
    rows[2].append(1)
</script>

{#each pairs() as (k, v) (k)}<span>{size(v)}</span>{/each}
<button class="grow" onclick={grow}>grow</button>
