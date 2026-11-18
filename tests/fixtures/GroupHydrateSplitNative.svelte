<script>
    // The same form in Svelte.
    let picked = $state('email');
    let alternative = $state();
</script>

<input data-k="email" type="radio" name="contact" value="email" bind:group={picked} />
<input data-k="mail" type="radio" name="contact" value="mail" bind:group={picked} />
<input data-k="other" type="radio" name="contact" value="other" bind:group={alternative} />
<p data-k="model">{picked ?? ''}|{alternative ?? ''}</p>
