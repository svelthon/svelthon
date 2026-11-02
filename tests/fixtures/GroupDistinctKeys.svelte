<script lang="python">
    bag = {0.5: [], 0: [], 1j: []}
    pairs = {(1, 2): []}
    flags = {False: [], True: []}
</script>

<input data-k="a" type="checkbox" value="a" bind:group={bag[0.5]} />
<input data-k="b" type="checkbox" value="b" bind:group={bag[0]} />
<input data-k="c" type="checkbox" value="c" bind:group={bag[1j]} />
<input data-k="d" type="checkbox" value="d" bind:group={pairs[(1.0, 2)]} />
<input data-k="e" type="checkbox" value="e" bind:group={pairs[(1, 2)]} />
<input data-k="f" type="checkbox" value="f" bind:group={flags[not 1]} />
<input data-k="g" type="checkbox" value="g" bind:group={flags[1]} />
<p>{bag[0.5]}|{bag[0]}|{bag[1j]}|{pairs[(1, 2)]}|{flags[False]}|{flags[True]}</p>
