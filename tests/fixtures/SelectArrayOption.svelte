<script lang="python">
# A single select whose first option's value is a JavaScript array, written
# here or put there by a Svelte child, with a spread that may make the select
# multiple, written alone or after its own `multiple`, and without, a class
# spelled `multiple` included; its model None or that array to begin with.
importjs ArrayOptions from "./ArrayOptions.svelte"

original: object = None
form: str = "spread"
child: bool = False
held: str = "none"

picked = original if held == "array" else None
attrs = {"multiple": False}


@export
def model():
    return [type(picked).__name__, picked is original, picked is None]
</script>

{#snippet options()}
    {#if child}
        <ArrayOptions {original} />
    {:else}
        <option value={original}>array</option>
        <option value={None}>none</option>
    {/if}
{/snippet}

{#if form == "spread"}
    <select {**attrs} bind:value={picked}>{@render options()}</select>
{:else if form == "after multiple"}
    <select multiple {**attrs} bind:value={picked}>{@render options()}</select>
{:else if form == "class word"}
    <select class=multiple bind:value={picked}>{@render options()}</select>
{:else}
    <select bind:value={picked}>{@render options()}</select>
{/if}
