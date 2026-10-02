<script>
// The same form in Svelte's own language.
let shown = $state(true);
let selected = $state([]);
</script>

<button onclick={() => (shown = false)}>hide</button>
{#if shown}
    <input data-k="gone" type="checkbox" value="gone" bind:group={selected} />
{/if}
<input data-k="kept" type="checkbox" value="kept" bind:group={selected} />
<p>{selected.join(',')}</p>
