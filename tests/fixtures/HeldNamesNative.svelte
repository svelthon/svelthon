<script>
    // The same component in Svelte, under the names Python reads: the witness
    // for HeldNames.
    import Child from './SnippetArgsChildNative.svelte';

    let tag = 'div';
    let flag = false;
    let Selected = Child;
</script>

{#snippet SvelthonElement0()}<output data-k="element">element</output>{/snippet}
{#snippet SvelthonChild1()}<output data-k="child">child</output>{/snippet}

<svelte:element this={tag} hidden={flag}>{@render SvelthonElement0()}</svelte:element>
<Selected>{@render SvelthonChild1()}</Selected>
