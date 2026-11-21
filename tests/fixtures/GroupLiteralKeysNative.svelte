<script>
    let bag = $state({ 1: [] });
</script>

<input data-k="a" type="checkbox" value="a" bind:group={bag[1]} />
<input data-k="b" type="checkbox" value="b" bind:group={bag["1"]} />
<p>{bag[1].join(',')}</p>
