<script>
    // The same child in Svelte.
    let { ticket = 'fallback', tick } = $props();
    let picked = $state('-');
</script>

<p data-k="summary">{ticket} ({tick})</p>
<button data-k="pick" onclick={() => (picked = ticket)}>{picked}</button>
