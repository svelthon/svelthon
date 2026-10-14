<script lang="python">
# A row JavaScript hands over, whose `value` is missing, `undefined`, `null` or
# set, read by a key with a default in each, a snippet and await.
row: object = None
place: str = "each"
</script>

{#snippet card({value=7})}<p>{str(value)}</p>{/snippet}

{#if place == "each"}{#each [row] as {value=7}}<p>{str(value)}</p>{/each}
{:else if place == "snippet"}{@render card(row)}
{:else}{#await row then {value=7}}<p>{str(value)}</p>{/await}{/if}
