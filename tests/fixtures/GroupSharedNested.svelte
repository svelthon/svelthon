<script lang="python">
# One object in the inner loop of two outer rows: the inner index is 0 in both,
# and the outer row the inner list comes from is what keeps them apart, as
# Svelte follows the binding out through the loop's iterable.
class Row:
    def __init__(self):
        self.selected = []


shared = Row()
groups = [[shared], [shared]]


@export
def read():
    return "|".join(",".join(row.selected) for rows in groups for row in rows)
</script>

{#each groups as rows, outer}
    {#each rows as row}
        <input data-k={str(outer)} type="checkbox" value={str(outer)} bind:group={row.selected} />
    {/each}
{/each}
