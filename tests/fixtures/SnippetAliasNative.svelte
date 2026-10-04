<script>
    // The same markup in Svelte: the witness for SnippetAlias.
    const selected = () => 7;
</script>

{#snippet row(fn, half)}<p data-k="row">{fn === selected}|{fn()}|{typeof half}</p>{/snippet}
{let alias = $state.raw(row)}
{@render row(selected, 0.5)}
{@render alias(selected, 0.5)}
