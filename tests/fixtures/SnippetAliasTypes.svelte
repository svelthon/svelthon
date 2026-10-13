<script lang="python">
# A snippet of this markup rendered by its name and through an alias, handed
# values a JavaScript number cannot carry: a whole float and two subclasses.
class Price(float):
    pass


class Label(str):
    pass
</script>

{#snippet row(value)}<p data-k="row">{type(value).__name__}:{value}</p>{/snippet}
{alias = row}
{@render row(1.0)}
{@render alias(1.0)}
{@render row(Price(0.5))}
{@render alias(Price(0.5))}
{@render row(Label("a"))}
{@render alias(Label("a"))}
