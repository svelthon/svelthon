<script>
    // The witness of `SpreadEntries.svelte` for None: what Svelte spreads of
    // `null`, on a component and on an element.
    import SpreadKeysChild from './SpreadKeysChild.svelte';

    let { on = 'component', nothing = null } = $props();
</script>

{#if on === 'element'}<i {...nothing}></i>{:else}<SpreadKeysChild {...nothing} />{/if}
