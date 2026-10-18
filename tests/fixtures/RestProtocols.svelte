<script lang="python">
# A row is a mapping by its class, not by a field or a property called `keys`.


class FieldRow:
    def __init__(self):
        self.first = 10
        self.keys = 3
        self.tail = 20


class PropertyRow:
    def __init__(self):
        self.first = 10
        self.tail = 20

    @property
    def keys(self):
        raise RuntimeError("keys property executed")


rows = [
    ("field", FieldRow()),
    ("property", PropertyRow()),
]
</script>

{#each rows as [kind, row]}
    {#each [row] as {first: selected, **rest}}
        <p data-k={kind}>{selected}|{",".join(sorted(rest))}</p>
    {/each}
{/each}
