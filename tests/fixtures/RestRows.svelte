<script lang="python">
# `...rest` over every row the fields are read from: a dict, a Python instance,
# a mapping by protocol, and the two rows a JavaScript library hands over.
importjs {records} from './rest_rows.js'


class Row:
    def __init__(self):
        self.first = 10
        self.tail = 20


class Pairs:
    def keys(self):
        return ["first", "tail"]

    def __getitem__(self, key):
        return {"first": 10, "tail": 20}[key]


rows = [
    ("dict", {"first": 10, "tail": 20}),
    ("instance", Row()),
    ("mapping", Pairs()),
    ("record", records[0]),
    ("class", records[1]),
]
</script>

{#each rows as [kind, row]}
    {#each [row] as {first: selected, ...rest}}
        <p data-k={kind}>{selected}|{",".join(rest)}</p>
    {/each}
{/each}
