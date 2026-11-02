<script lang="python">
# Two checkboxes of one group, keyed by a float a snippet is handed.
bag = {0.5: [], -0.0: []}
</script>

{#snippet row(k)}
    <div data-k={k}>
        <input type="checkbox" value="a" bind:group={bag[k]} />
        <input type="checkbox" value="b" bind:group={bag[k]} />
        <output>{",".join(sorted(bag[k]))}</output>
    </div>
{/snippet}

{@render row(0.5)}
{@render row(-0.0)}
