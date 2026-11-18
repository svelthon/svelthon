<script>
    // The same child in Svelte.
    let { entry, rows, tick } = $props();
</script>

{#each rows as row}<a data-k="row" href={row.url}>Open {row.id} ({tick})</a>{/each}
{#snippet link(one)}<a data-k="snippet" href={one.url}>Open {one.id} ({tick})</a>{/snippet}
{@render link(entry)}
<button data-k="spread" {...entry.action} data-step={tick}>Save {tick}</button>
