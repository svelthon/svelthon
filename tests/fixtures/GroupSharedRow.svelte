<script lang="python">
# One object in two rows: Svelte keeps a group per iteration, so each row's
# boxes are a group of their own, writing the shared field in turn.
class Row:
    def __init__(self):
        self.selected = []


shared = Row()
rows = [shared, shared]


@export
def read():
    return "|".join(",".join(row.selected) for row in rows)
</script>

{#each rows as row, at}
    <input data-k={str(at)} type="checkbox" value={str(at)} bind:group={row.selected} />
{/each}
