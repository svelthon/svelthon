<script>
    // A JavaScript parent whose snippet expects a number.
    import SnippetForeignAlias from './SnippetForeignAlias.svelte';
</script>

<SnippetForeignAlias>
    {#snippet children(value)}<p data-k="parent">{typeof value}:{value.toFixed(2)}</p>{/snippet}
</SnippetForeignAlias>
