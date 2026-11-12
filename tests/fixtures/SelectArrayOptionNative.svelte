<script>
    // The same selects in Svelte, None its `undefined`: the witness for
    // SelectArrayOption.
    import { untrack } from 'svelte';
    import ArrayOptions from './ArrayOptions.svelte';

    let { original, form = 'spread', child = false, held = 'none' } = $props();

    let picked = $state.raw(untrack(() => (held === 'array' ? original : undefined)));
    const attrs = { multiple: false };

    export function model() {
        return [Array.isArray(picked) ? 'JavascriptArray' : typeof picked, picked === original, picked === undefined];
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

{#if form === 'spread'}
    <select {...attrs} bind:value={picked}>{@render options()}</select>
{:else if form === 'after multiple'}
    <select multiple {...attrs} bind:value={picked}>{@render options()}</select>
{:else if form === 'class word'}
    <select class=multiple bind:value={picked}>{@render options()}</select>
{:else}
    <select bind:value={picked}>{@render options()}</select>
{/if}
