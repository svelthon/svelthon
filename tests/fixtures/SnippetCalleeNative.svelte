<script>
    // The same markup in Svelte: the witness for SnippetCallee.
    const pick = (first, second) => first;
</script>

{#snippet first(value)}<p data-k="first">{typeof value}:{value}</p>{/snippet}
{#snippet second(value)}<p data-k="second">{typeof value}:{value}</p>{/snippet}
{@render (first)(1.0)}
{@render (true ? first : second)(1.0)}
{@render pick(first, second)(1.0)}
{@render pick(first, second)(true)}
