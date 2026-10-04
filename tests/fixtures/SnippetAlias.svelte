<script lang="python">
# A snippet of this markup rendered by its name and through an alias: what it is
# handed is the same either way, a callable as itself and a float as a float.
def selected():
    return 7
</script>

{#snippet row(fn, half)}<p data-k="row">{fn is selected}|{fn()}|{type(half).__name__}</p>{/snippet}
{alias = row}
{@render row(selected, 0.5)}
{@render alias(selected, 0.5)}
