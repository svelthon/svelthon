<script lang="python">
    bag = {1: [], 0: []}
</script>

<input data-k="a" type="checkbox" value="a" bind:group={bag[1]} />
<input data-k="b" type="checkbox" value="b" bind:group={bag[+1]} />
<input data-k="c" type="checkbox" value="c" bind:group={bag[-(-1)]} />
<input data-k="d" type="checkbox" value="d" bind:group={bag[0]} />
<input data-k="e" type="checkbox" value="e" bind:group={bag[-0.0]} />
<p>{",".join(bag[1])}|{",".join(bag[0])}</p>
