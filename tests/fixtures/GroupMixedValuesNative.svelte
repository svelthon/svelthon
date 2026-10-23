<script>
    // The witness: the same four controls in Svelte itself.
    let { next_value } = $props();
    let radio = $state(null);
    let first = $state(null);
    let box = $state([]);
    let twice = $state([]);
</script>

<input data-k="radio" type="radio" value="v-{next_value()}" bind:group={radio} />
<input data-k="first" type="radio" bind:group={first} value="v-{next_value()}" />
<input data-k="box" type="checkbox" value="v-{next_value()}" bind:group={box} />
<input data-k="twice" type="checkbox" value="v-{next_value()}-{next_value()}" bind:group={twice} />

<p data-k="radio-model">{radio}</p>
<p data-k="first-model">{first}</p>
<p data-k="box-model">{box.join(' ')}</p>
<p data-k="twice-model">{twice.join(' ')}</p>
