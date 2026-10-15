<script>
    // EachRowRekey in Svelte.
    let rows = $state([0, 1, 2].map((n) => ({ id: n, label: String(n) })));
</script>

{#each rows as row (row.id)}
    <span>{row.label}</span>
{/each}
<button onclick={() => (rows[1].id = 9)}>rename</button>
