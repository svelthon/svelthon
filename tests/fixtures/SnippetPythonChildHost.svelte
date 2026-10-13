<script>
    // A JavaScript parent of the same child: its snippet is handed JavaScript values.
    import SnippetPythonChild from './SnippetPythonChild.svelte';

    let { kind = 'bare' } = $props();
</script>

<SnippetPythonChild {kind}>
    {#snippet children(whole, price, label)}<p data-k="parent">{typeof whole}:{whole}|{typeof price}|{typeof label}</p>{/snippet}
</SnippetPythonChild>
