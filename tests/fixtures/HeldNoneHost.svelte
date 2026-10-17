<script lang="python">
# A Python parent handing None to a JavaScript child it holds by a name it
# assigned, by every way a prop is written, and to the child its import names.
importjs Native from "./HeldNoneChild.svelte"

Pick = Native
value = None
</script>

<Native value={value} bind:bound={value} label="direct" />
<Pick value={value} bind:bound={value} label="named" />
<Pick {**{"value": value, "label": "spread"}} />
<svelte:component this={Pick} value={value} label="component" />
