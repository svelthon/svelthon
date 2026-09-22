<script lang="python">
# Three checkboxes in document order, so the clicks can be made in any order and
# the answer compared with what Svelte gives for the same markup.
picked = []
</script>

<input data-k="a" type="checkbox" value="a" bind:group={picked} />
<input data-k="b" type="checkbox" value="b" bind:group={picked} />
<input data-k="c" type="checkbox" value="c" bind:group={picked} />

<p data-k="picked">{",".join(picked)}</p>
