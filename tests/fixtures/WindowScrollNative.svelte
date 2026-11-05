<script>
    // Svelte's witness for WindowScrollXY.svelte and WindowScrollYX.svelte.
    let position = $state({ x: 0, y: 0 });
</script>

<svelte:window bind:scrollX={position.x} bind:scrollY={position.y} />
<p data-k="model">{position.x} {position.y}</p>
