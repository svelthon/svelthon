<script>
    // The same form in Svelte.
    let picked = $state('a');
    let confirmed = $state('');
</script>

<form data-k="form">
    <input data-k="a" type="radio" name="contact" value="a" bind:group={picked} />
    <input data-k="b" type="radio" name="contact" value="b" bind:group={picked} />
    <button data-k="confirm" type="button" onclick={() => (confirmed = picked)}>Confirmer</button>
    <p data-k="message">{confirmed}</p>
</form>
