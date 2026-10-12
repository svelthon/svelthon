<script lang="python">
# `Child` imports a Python component, and the snippet's parameter of that name
# holds whatever component it is handed: here a JavaScript one, which reads
# JavaScript's own values by every way a prop is written.
importjs Child from './ShadowedPythonChild.svelte'
importjs Native from './ShadowedNativeChild.svelte'

value = 0.25
</script>

{#snippet via(Child)}
    <div data-k="named"><Child value={value} /></div>
    <div data-k="short"><Child {value} /></div>
    <div data-k="spread"><Child {**{"value": value}} /></div>
    <div data-k="bound"><Child bind:value={value} /></div>
{/snippet}

{@render via(Native)}
