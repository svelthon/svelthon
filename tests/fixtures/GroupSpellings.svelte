<script lang="python">
    bag = {"selected": []}
</script>

<input data-k="a" type="checkbox" value="a" bind:group={bag["selected"]} />
<input data-k="b" type="checkbox" value="b" bind:group={bag[ "selected" ]} />
<input data-k="c" type="checkbox" value="c" bind:group={bag['selected']} />
<p>{",".join(bag["selected"])}</p>
