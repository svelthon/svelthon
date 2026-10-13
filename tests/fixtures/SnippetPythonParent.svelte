<script lang="python">
# The Python parent whose snippet SnippetPythonChild renders.
importjs SnippetPythonChild from "./SnippetPythonChild.svelte"
kind: str = "bare"
</script>

<SnippetPythonChild {kind}>
    {#snippet children(whole, price, label)}<p data-k="parent">{type(whole).__name__}:{whole}|{type(price).__name__}|{type(label).__name__}</p>{/snippet}
</SnippetPythonChild>
