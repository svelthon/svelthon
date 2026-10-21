<script>
    // A component that fails as it is built, under a boundary that builds it
    // again on demand.
    let { Child, shared } = $props();
</script>

<svelte:boundary>
    <Child {shared} />

    {#snippet failed(error, reset)}
        <button data-k="retry" onclick={reset}>retry</button>
    {/snippet}
</svelte:boundary>
