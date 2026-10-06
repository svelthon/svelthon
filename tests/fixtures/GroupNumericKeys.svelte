<script lang="python">
    bag = {1: []}
    one = 1
</script>

<input data-k="a" type="checkbox" value="a" bind:group={bag[1]} />
<input data-k="b" type="checkbox" value="b" bind:group={bag[1.0]} />
<input data-k="c" type="checkbox" value="c" bind:group={bag[True]} />
<input data-k="d" type="checkbox" value="d" bind:group={bag[one]} />
<p>{",".join(bag[1])}</p>
