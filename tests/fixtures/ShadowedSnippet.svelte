<script lang="python">
other: object
kind: str = "parameter"
</script>

{#snippet local(n)}<b>{n}</b>{/snippet}
{#snippet dispatch(local)}{@render local(1.5)}{/snippet}

{#if kind == "parameter"}
    {@render dispatch(other)}
{:else}
    {#each [other] as local}{@render local(1.5)}{/each}
{/if}
