<script>
    let seed = 0;
</script>

{#if true}
    {let files = $state.raw(null)}
    <input type="file" bind:files={files} />
    <p>{files === null ? 'none' : files.length}</p>
{/if}
