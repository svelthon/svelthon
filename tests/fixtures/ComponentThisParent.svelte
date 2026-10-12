<script lang="python">
# `<svelte:component this={…}>` holds its child as a tag does, and so does a
# lone interpolation between quotes, which Svelte reads as the same expression.
importjs Child from './ShadowedPythonChild.svelte'
importjs Native from './ShadowedNativeChild.svelte'

value = 15.0
</script>

<span data-k="python"><svelte:component this={Child} value={value} /></span>
<span data-k="native"><svelte:component this={Native} value={value} /></span>
<span data-k="double quotes"><svelte:component this="{Child}" value={value} /></span>
<span data-k="single quotes"><svelte:component this='{Child}' value={value} /></span>
