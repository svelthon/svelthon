<script lang="python">
# The snippet the parent gives, rendered through an alias beside a snippet of
# this markup: it is still the parent's, and is handed a number.
children: object = None
</script>

{#snippet row(value)}<p data-k="own">{type(value).__name__}:{value}</p>{/snippet}
{alias = children}
{@render row(1.0)}
{@render alias(0.5)}
