<script>
    let selected = $state([0.25]);

    // Reassigned: the array the binding writes back is not a proxy, so a
    // mutation of it would not be seen.
    function clear() {
        selected = [];
    }
</script>

<select data-k="script" multiple bind:value={selected}>
    <option value={0.25}>quarter</option>
    <option value={0.5}>half</option>
</select>
<button onclick={clear}>clear</button>
<output>{selected.length}</output>
