<script lang="python">
# Each iterable a builtin makes as it goes, handed to a JavaScript child, and
# beside it the list `list()` makes of the same: the child reads both alike.
importjs ListedChildJs from "./ListedChildJs.svelte"

table = {"a": 1, "b": 2}
lazy = [
    range(3),
    table.keys(),
    table.items(),
    (n * 2 for n in [1, 2]),
    map(str, [1, 2]),
    zip([1, 2], "ab"),
    enumerate("ab"),
    filter(None, [0, 1]),
    reversed([1, 2]),
]
listed = [
    list(range(3)),
    list(table.keys()),
    list(table.items()),
    [2, 4],
    ["1", "2"],
    [(1, "a"), (2, "b")],
    [(0, "a"), (1, "b")],
    [1],
    [2, 1],
]
</script>

<div data-k="lazy">{#each lazy as one}<ListedChildJs value={one} />{/each}</div>
<div data-k="listed">{#each listed as one}<ListedChildJs value={one} />{/each}</div>
