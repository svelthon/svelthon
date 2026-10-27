<script lang="python">
# Positional patterns read as JavaScript reads them: as many elements as the
# pattern names positions, a hole being one and a trailing comma none, and each
# element once, a default included.
trailing: object
holes: object
leading: object
counted: object
missing: object
</script>

{#snippet one([value,])}<output data-k="trailing">{value}</output>{/snippet}
{#snippet two([value,,])}<output data-k="holes">{value}</output>{/snippet}
{#snippet three([, value,])}<output data-k="leading">{value}</output>{/snippet}
{#snippet four([value=7])}<output data-k="counted">{value}</output>{/snippet}
{#snippet five([value=7])}<output data-k="missing">{value}</output>{/snippet}
{@render one(trailing)}
{@render two(holes)}
{@render three(leading)}
{@render four(counted)}
{@render five(missing)}
