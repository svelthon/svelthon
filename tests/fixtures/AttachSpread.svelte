<script lang="python">
# An attachment handed by a spread, under Svelte's attachment key, onto an
# element and to a JavaScript child that spreads it onto its own. The witness
# is `AttachSpreadNative.svelte`.
importjs { key } from "./attach_spread.js"
importjs Target from "./AttachSpreadTarget.svelte"

passed: bool = False


def stamp(element):
    raise ValueError("attachment boom")


attrs = {key: stamp}
</script>

{#if passed}
    <Target {**attrs} />
{:else}
    <p {**attrs}>direct</p>
{/if}
