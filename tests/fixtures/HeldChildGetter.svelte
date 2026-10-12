<script lang="python">
# The child a tag holds is read once, as Svelte reads a tag, however many
# props it is handed: `Box.Child` may be a getter.
holder: object = None
value = 15.0
</script>

{#snippet via(Box)}
    <Box.Child value={value} other={value} />
{/snippet}

<div data-k="held">{@render via(holder)}</div>
