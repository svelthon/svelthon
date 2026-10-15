<script lang="python">
# A row that is a tuple, replaced by an equal one, under a key of its identity,
# a key of its value, or none.
keying: str = "identity"
rows = [tuple([1, 2])]


def replace():
    rows[0] = tuple([1, 2])
</script>

<output>{id(rows[0])}</output>
{#if keying == "identity"}
    {#each rows as row (id(row))}<span>{id(row)}</span>{/each}
{:else if keying == "value"}
    {#each rows as row (row[0])}<span>{id(row)}</span>{/each}
{:else}
    {#each rows as row}<span>{id(row)}</span>{/each}
{/if}
<button onclick={replace}>replace</button>
