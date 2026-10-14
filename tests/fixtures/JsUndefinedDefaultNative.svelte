<script>
    // The same patterns in Svelte: the witness for JsUndefinedDefault, a
    // `null` shown as Python shows None.
    let { row, place = 'each' } = $props();

    const shown = (value) => (value === null ? 'None' : String(value));
</script>

{#snippet card({ value = 7 })}<p>{shown(value)}</p>{/snippet}

{#if place === 'each'}{#each [row] as { value = 7 }}<p>{shown(value)}</p>{/each}
{:else if place === 'snippet'}{@render card(row)}
{:else}{#await row then { value = 7 }}<p>{shown(value)}</p>{/await}{/if}
