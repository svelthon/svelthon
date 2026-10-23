<script>
    // The witness of `DocumentGroup.svelte`.
    let picked = $state(['one']);
    let chosen = $state('two');
</script>

<input type="checkbox" value="one" bind:group={picked} />
<input type="checkbox" value="two" bind:group={picked} />
<input type="radio" value="one" bind:group={chosen} />
<input type="radio" value="two" bind:group={chosen} />
