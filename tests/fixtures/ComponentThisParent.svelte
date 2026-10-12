<script lang="python">
# `<svelte:component this={…}>` holds its child as a tag does.
importjs Child from './ShadowedPythonChild.svelte'
importjs Native from './ShadowedNativeChild.svelte'

value = 15.0
</script>

<span data-k="python"><svelte:component this={Child} value={value} /></span>
<span data-k="native"><svelte:component this={Native} value={value} /></span>
