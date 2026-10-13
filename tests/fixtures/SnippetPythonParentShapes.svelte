<script lang="python">
# Python parents whose snippet takes its arguments apart: a list unpacked by
# position, and a default computed from the parameters before it. Neither
# snippet is rendered here first, so the child's call is the first it gets.
importjs SnippetPythonChild from "./SnippetPythonChild.svelte"
shape: str = "pattern"
</script>

{#if shape == "pattern"}
    <SnippetPythonChild kind="list">
        {#snippet children([whole, price, label])}<p data-k="parent">{type(whole).__name__}:{whole}|{type(price).__name__}|{type(label).__name__}</p>{/snippet}
    </SnippetPythonChild>
{:else}
    <SnippetPythonChild kind="bare">
        {#snippet children(whole, price, label, summary=type(whole).__name__ + "|" + type(price).__name__ + "|" + type(label).__name__)}<p data-k="parent">{summary}</p>{/snippet}
    </SnippetPythonChild>
{/if}
