<script>
    // The same child in Svelte.
    let { ticket, whole, rev } = $props();

    let upper = $derived(ticket + '!');

    function mine() {
        ticket = 'mine';
    }
</script>

<p data-k="child">{rev}|{ticket}|{upper}|{whole.ticket}</p>
<button data-k="mine" onclick={mine}>m</button>
