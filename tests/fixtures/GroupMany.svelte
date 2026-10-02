<script lang="python">
# Two hundred checkboxes in one group, mounted together: what putting them in
# document order costs, and that the order is still the document's.
rows = list(range(200))
selected = []
</script>

{#each rows as row}
    <input type="checkbox" value={row} bind:group={selected} />
{/each}
<p>{",".join(str(one) for one in selected)}</p>
