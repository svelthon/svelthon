<script lang="python">
# A Python parent whose snippet a Python child renders: what it is handed reads
# as Python values.
importjs SnippetArgsChild from "./SnippetArgsChild.svelte"
</script>

<SnippetArgsChild>
    {#snippet children(value, absence, callback)}
        <p data-k="python">{type(value).__name__}:{value * 2}|{absence is None}|{callback()}</p>
    {/snippet}
</SnippetArgsChild>
