<script>
    // Options a Svelte child puts in a select it is given: the first one's value
    // a JavaScript array.
    let { original } = $props();
</script>

<option value={original}>array</option>
<option value={undefined}>none</option>
