<script lang="python">
seed = 0
</script>

{#if True}
    {files = None}
    <input type="file" bind:files={files} />
    <p>{"none" if files is None else len(files)}</p>
{/if}
