<script lang="python">
def boom():
    raise ValueError("thrown from Python")
</script>

<svelte:boundary>
    <p data-k="body">{boom()}</p>
    {#snippet failed(error, reset)}<p data-k="failed">caught</p>{/snippet}
</svelte:boundary>
