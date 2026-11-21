<script lang="python">
# One object in the inner loop of the two rows of an outer loop that names no
# row, only its index, keyed by it or not: that index keeps the rows apart.
class Row:
    def __init__(self):
        self.selected = []


shared = Row()
groups = [[shared], [shared]]
keyed: bool = False


@export
def read():
    return "|".join(",".join(row.selected) for rows in groups for row in rows)
</script>

{#if keyed}
    {#each groups, outer (outer)}
        {#each groups[outer] as row}
            <input data-k={str(outer)} type="checkbox" value={str(outer)} bind:group={row.selected} />
        {/each}
    {/each}
{:else}
    {#each groups, outer}
        {#each groups[outer] as row}
            <input data-k={str(outer)} type="checkbox" value={str(outer)} bind:group={row.selected} />
        {/each}
    {/each}
{/if}
