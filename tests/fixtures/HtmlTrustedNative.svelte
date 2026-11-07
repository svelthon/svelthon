<script>
    // Svelte's witness for HtmlTrusted.svelte.
    let { markup } = $props();
</script>

<section data-k="alone">{@html markup}</section>
<p data-k="among">before {@html markup} after</p>
