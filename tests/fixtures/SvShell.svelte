<script module>
    import { fade } from 'svelte/transition';
</script>

<script lang="python">
shown = True
title = "title"
</script>

<svelte:head><title>{title}</title></svelte:head>

{#if shown}<p data-k="fade" transition:fade>visible</p>{/if}

<svelte:boundary>
    <p data-k="inside">inside the boundary</p>
    {#snippet failed(error)}<p data-k="failed">caught</p>{/snippet}
</svelte:boundary>
