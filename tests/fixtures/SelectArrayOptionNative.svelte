<script>
    // The same selects in Svelte, None its `undefined`: the witness for
    // SelectArrayOption.
    import ArrayOptions from './ArrayOptions.svelte';

    let { original, spread = true, child = false } = $props();

    let picked = $state.raw(undefined);
    const attrs = { multiple: false };

    export function model() {
        return [Array.isArray(picked) ? 'JavascriptArray' : typeof picked, picked === original];
    }
</script>

{#snippet options()}
    {#if child}
        <ArrayOptions {original} />
    {:else}
        <option value={original}>array</option>
        <option value={undefined}>none</option>
    {/if}
{/snippet}

{#if spread}
    <select {...attrs} bind:value={picked}>{@render options()}</select>
{:else}
    <select bind:value={picked}>{@render options()}</select>
{/if}
