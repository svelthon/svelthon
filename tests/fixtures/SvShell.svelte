<script module>
    import { fade } from 'svelte/transition';
</script>

<script lang="python">
shown = True
title = "titre"
</script>

<svelte:head><title>{title}</title></svelte:head>

{#if shown}<p data-k="fade" transition:fade>visible</p>{/if}

<svelte:boundary>
    <p data-k="inside">dans la frontière</p>
    {#snippet failed(error)}<p data-k="failed">rattrapé</p>{/snippet}
</svelte:boundary>
