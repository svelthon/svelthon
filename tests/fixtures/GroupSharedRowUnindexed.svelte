<script lang="python">
# The same rows with no index written: the group still needs the iteration's,
# and the loop is given one.
class Row:
    def __init__(self):
        self.selected = []


shared = Row()
rows = [(shared, "0"), (shared, "1")]


@export
def read():
    return "|".join(",".join(row.selected) for row, _ in rows)
</script>

{#each rows as (row, label)}
    <input data-k={label} type="checkbox" value={label} bind:group={row.selected} />
{/each}
