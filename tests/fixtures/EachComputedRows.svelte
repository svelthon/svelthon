<script lang="python">
# The rows of a block computed from a dict of lists, a list of dicts, and a
# prop, each in four ways, counting how often they are computed: a change
# inside one row, then a row added.
importjs { count } from "./counting.js"
kind: str = "sorted"
given: dict = None
d = {f"k{i}": [i] for i in range(5)}
rows = [{"n": i} for i in range(5)]


def computed():
    count("rows")
    if kind == "sorted":
        return sorted(d.items())
    if kind == "items":
        return d.items()
    if kind == "enumerate":
        return enumerate(rows)
    if kind == "comprehension":
        return [row for row in rows]
    return sorted(given.items())


def grow():
    d["k2"].append(9)
    rows[2]["n"] += 1
    if given is not None:
        given["k2"].append(9)


def add():
    d["k5"] = [5]
    rows.append({"n": 5})
    if given is not None:
        given["k5"] = [5]
</script>

{#each computed() as row}<span>{row}</span>{/each}
<button class="grow" onclick={grow}>grow</button>
<button class="add" onclick={add}>add</button>
