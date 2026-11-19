<script lang="python">
# Patterns with a default over rows holding None, which takes the default as
# JavaScript takes it for `undefined`, by the rule of every door.
pairs = [[{"first": 5}, None], [{"first": 6}, 7]]
keyed = [{"a": None}, {"a": 2}]
</script>

{#each pairs as [{first}, second=first]}<output data-k="pairs">{first}:{second}</output>{/each}
{#each keyed as {a=1}}<output data-k="keyed">{a}</output>{/each}
{#snippet line(x=7)}<output data-k="param">{x}</output>{/snippet}
{@render line(None)}{@render line(3)}
