<script lang="python">
# One object in two loops that each declare `row`: two declarations, two
# groups, whatever object they hand over.
class Row:
    def __init__(self):
        self.selected = []


shared = Row()
rows = [shared]


@export
def read():
    return "|".join(",".join(row.selected) for row in rows + rows)
</script>

{#each rows as row}
    <input data-k="0" type="checkbox" value="0" bind:group={row.selected} />
{/each}
{#each rows as row}
    <input data-k="1" type="checkbox" value="1" bind:group={row.selected} />
{/each}
