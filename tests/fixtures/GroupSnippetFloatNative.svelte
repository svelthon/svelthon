<script>
    // GroupSnippetFloat in Svelte.
    let bag = $state({ 0.5: [], 0: [] });
</script>

{#snippet row(k)}
    <div data-k={k}>
        <input type="checkbox" value="a" bind:group={bag[k]} />
        <input type="checkbox" value="b" bind:group={bag[k]} />
        <output>{[...bag[k]].sort().join(',')}</output>
    </div>
{/snippet}

{@render row(0.5)}
{@render row(-0)}
