<script>
    // The same in Svelte, Python's truth of the list its length: the witness
    // for UnquotedWords.
    let { held = [] } = $props();

    let picked = $state(['a']);
</script>

<input type="checkbox" title=checked value="a" bind:group={picked}>
<button title=is disabled={held.length > 0} hidden={held.length > 0}>button</button>
