<script lang="python">
pass
</script>

{#snippet item(callback)}<p data-k="item">{callback(1, 2)}</p>{/snippet}
{#snippet scaled(value, by=lambda x, y=2: x * y)}<p data-k="scaled">{by(value)}</p>{/snippet}

{@render item(lambda x, y: x + y)}
{@render scaled(5)}
