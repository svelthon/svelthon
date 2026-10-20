<script lang="python">
    # Two snippets whose names Python reads as the ones the compiler gives the
    # tags it holds: `𝓢`, a mathematical letter, is `S` once NFKC has read it.
    importjs Child from "./SnippetArgsChildNative.svelte"

    tag = "div"
    flag = False
    Selected = Child
</script>

{#snippet 𝓢velthonElement0()}<output data-k="element">element</output>{/snippet}
{#snippet 𝓢velthonChild1()}<output data-k="child">child</output>{/snippet}

<svelte:element this={tag} hidden={flag}>{@render 𝓢velthonElement0()}</svelte:element>
<Selected>{@render 𝓢velthonChild1()}</Selected>
