<script>
    // The same rows in Svelte, each reading one shared pair: what mounting them
    // costs the page.
    let { n = 3000 } = $props();

    const shared = [1, 2];
    const rows = $derived(Array.from({ length: n }, () => ({ c: shared })));
    const held = [shared];
</script>

<p>{rows.reduce((total, row) => total + row.c.length, 0)}</p>
{#each rows as row}{#each held as c}<i>{c.length}</i>{/each}{/each}
