<script lang="python">
# One object in the inner loop of two outer rows, the inner loop declaring the
# outer one's index name: the outer row is still what keeps them apart.
class Row:
    def __init__(self):
        self.selected = []


shared = Row()
groups = [{"key": "0", "rows": [shared]}, {"key": "1", "rows": [shared]}]


@export
def read():
    return "|".join(",".join(row.selected) for group in groups for row in group["rows"])
</script>

{#each groups as group, i}
    {#each group["rows"] as row, i}
        <input data-k={group["key"]} type="checkbox" value={group["key"]} bind:group={row.selected} />
    {/each}
{/each}
