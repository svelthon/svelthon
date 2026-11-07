<script>
    // Svelte's witness for AttachSpread.svelte.
    import { key } from './attach_spread.js';
    import Target from './AttachSpreadTarget.svelte';

    let { passed = false } = $props();

    function stamp() {
        throw new Error('attachment boom');
    }

    const attrs = { [key]: stamp };
</script>

{#if passed}
    <Target {...attrs} />
{:else}
    <p {...attrs}>direct</p>
{/if}
