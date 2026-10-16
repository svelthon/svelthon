<script>
    // EachNone in Svelte: `null` walked by an `{#each}`.
    let { items = null } = $props();
</script>

<p data-k="plain">{#each items as one}<i>{one}</i>{/each}</p>
<p data-k="else">{#each items as one}<i>{one}</i>{:else}<b>empty</b>{/each}</p>
