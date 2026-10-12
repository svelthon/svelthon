<script lang="python">
# `Child` imports a Python component, and the snippet's parameter of that name
# holds whatever component it is handed: a JavaScript one reads JavaScript's
# own values, a Python one the Python values, by every way a prop is written.
importjs Child from './ShadowedPythonChild.svelte'
importjs Native from './ShadowedNativeChild.svelte'

value = 15.0
</script>

{#snippet via(Child)}
    <div data-k="named"><Child value={value} /></div>
    <div data-k="short"><Child {value} /></div>
    <div data-k="spread"><Child {**{"value": value}} /></div>
    <div data-k="bound"><Child bind:value={value} /></div>
{/snippet}

<div data-r="native">{@render via(Native)}</div>
<div data-r="python">{@render via(Child)}</div>
