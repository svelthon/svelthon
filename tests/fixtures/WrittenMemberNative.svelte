<script>
    let { ticket, revision } = $props();
    const confirmation = $derived(ticket.label + '!');
</script>

<p data-k="child">{revision}|{ticket.label}|{confirmation}</p>
<button data-k="edit" onclick={() => (ticket.label = 'mine')}>e</button>
