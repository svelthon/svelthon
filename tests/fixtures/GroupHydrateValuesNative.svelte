<script>
    // Svelte's witness for GroupHydrateValues.svelte.
    let boxes = $state(['a']);
    let choice = $state('a');
</script>

<input data-k="box-a" type="checkbox" value={'a'} bind:group={boxes} />
<input data-k="box-b" type="checkbox" value={'b'} bind:group={boxes} />
{#each ['a', 'b'] as one}
    <input data-k={`radio-${one}`} type="radio" name="choice" value={one} bind:group={choice} />
{/each}
<p data-k="model">{boxes.join(',')}|{choice}</p>
