<script>
    // EachRowTuple in Svelte, an array for the tuple, each told by a number of
    // its own for Python's `id()`.
    let { keying = 'identity' } = $props();

    let made = 0;
    const tuple = () => Object.assign([1, 2], { id: ++made });

    let rows = $state.raw([tuple()]);

    const replace = () => {
        rows = [tuple()];
    };
</script>

<output>{rows[0].id}</output>
{#if keying === 'identity'}
    {#each rows as row (row)}<span>{row.id}</span>{/each}
{:else if keying === 'value'}
    {#each rows as row (row[0])}<span>{row.id}</span>{/each}
{:else}
    {#each rows as row}<span>{row.id}</span>{/each}
{/if}
<button onclick={replace}>replace</button>
