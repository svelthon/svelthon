<script lang="python">
# Two controls standing for one choice, which is what a form does when it shows
# the same option in two sections.
selected = []
</script>

<input data-k="a1" type="checkbox" value="a" bind:group={selected} />
<input data-k="b" type="checkbox" value="b" bind:group={selected} />
<input data-k="a2" type="checkbox" value="a" bind:group={selected} />

<p data-k="picked">{",".join(selected)}</p>
