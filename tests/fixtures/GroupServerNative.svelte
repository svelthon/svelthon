<script>
    // The same groups written in Svelte, the witness for `GroupServer`.
    let picked = $state(['b']);
    let choice = $state('y');
    let halves = $state([0.5]);
</script>

<input data-k="a" type="checkbox" value="a" bind:group={picked} />
<input data-k="b" type="checkbox" value="b" bind:group={picked} />
<input data-k="x" type="radio" value="x" bind:group={choice} />
<input data-k="y" type="radio" value="y" bind:group={choice} />
<input data-k="quarter" type="checkbox" value={0.25} bind:group={halves} />
<input data-k="half" type="checkbox" value={0.5} bind:group={halves} />
