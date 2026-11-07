<script>
    // Svelte's witness for GroupResetNone.svelte, None being `undefined`.
    let choice = $state(undefined);

    export function seen() {
        return String(choice);
    }
</script>

<form>
    <input data-k="none" type="radio" name="r" value={undefined} bind:group={choice} />
    <input data-k="b" type="radio" name="r" value={'b'} bind:group={choice} />
</form>
<p data-k="choice">{choice}</p>
