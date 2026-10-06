<script lang="python">
    bag = {1: []}
    one = 1
    typed = {"1": [], "True": []}
</script>

<input data-k="a" type="checkbox" value="a" bind:group={bag[1]} />
<input data-k="b" type="checkbox" value="b" bind:group={bag[1.0]} />
<input data-k="c" type="checkbox" value="c" bind:group={bag[True]} />
<input data-k="d" type="checkbox" value="d" bind:group={bag[one]} />
<p>{",".join(bag[1])}</p>
<input data-k="e" type="checkbox" value="e" bind:group={typed[str(1)]} />
<input data-k="f" type="checkbox" value="f" bind:group={typed[str(True)]} />
<output>{typed}</output>
