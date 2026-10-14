<script lang="python">
# One tuple held by every row of a watched list, and read by a block of each row:
# a tuple of numbers, or one holding a list, which changes, or one of a
# subclass, whose attributes do.
kind: str = "numbers"
n: int = 3000


class Labelled(tuple):
    pass


if kind == "numbers":
    shared = (1, 2)
elif kind == "list inside":
    shared = ([1], 2)
else:
    shared = Labelled((1, 2))
    shared.label = "old"

rows = [{"c": shared} for _ in range(n)]
held = [shared]


def count():
    return sum(len(row["c"]) for row in rows)


def grow():
    rows[0]["c"][0].append(2)


def relabel():
    rows[0]["c"].label = "new"


def shown():
    if kind == "list inside":
        return len(rows[0]["c"][0])
    if kind == "subclass":
        return rows[0]["c"].label
    return count()
</script>

<button onclick={relabel if kind == "subclass" else grow}>change</button>
<p>{shown()}</p>
{#each rows as row}{#each held as c}<i>{len(c)}</i>{/each}{/each}
