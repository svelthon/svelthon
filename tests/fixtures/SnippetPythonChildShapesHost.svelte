<script>
    // JavaScript parents of the same child, the same two shapes: their snippets
    // are handed JavaScript values.
    import SnippetPythonChild from './SnippetPythonChild.svelte';

    let { shape = 'pattern' } = $props();
</script>

{#if shape === 'pattern'}
    <SnippetPythonChild kind="list">
        {#snippet children([whole, price, label])}<p data-k="parent">{typeof whole}:{whole}|{typeof price}|{typeof label}</p>{/snippet}
    </SnippetPythonChild>
{:else}
    <SnippetPythonChild kind="bare">
        {#snippet children(whole, price, label, summary = `${typeof whole}|${typeof price}|${typeof label}`)}<p data-k="parent">{summary}</p>{/snippet}
    </SnippetPythonChild>
{/if}
