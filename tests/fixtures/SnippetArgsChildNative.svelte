<script>
    // The same child in Svelte: the witness for SnippetArgsChild.
    let { children, footer } = $props();

    const zero = () => 7;
</script>

{@render children?.(0.25, undefined, zero)}
{@render footer?.()}
<p data-k="ready">ready</p>
