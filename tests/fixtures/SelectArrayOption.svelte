<script lang="python">
# A single select whose first option's value is a JavaScript array, written
# here or put there by a Svelte child, with a spread that may make the select
# multiple, and without.
importjs ArrayOptions from "./ArrayOptions.svelte"

original: object = None
spread: bool = True
child: bool = False

picked = None
attrs = {"multiple": False}


@export
def model():
    return [type(picked).__name__, picked is original]
</script>

{#snippet options()}
    {#if child}
        <ArrayOptions {original} />
    {:else}
        <option value={original}>array</option>
        <option value={None}>none</option>
    {/if}
{/snippet}

{#if spread}
    <select {**attrs} bind:value={picked}>{@render options()}</select>
{:else}
    <select bind:value={picked}>{@render options()}</select>
{/if}
