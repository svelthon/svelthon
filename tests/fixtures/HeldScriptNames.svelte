<script lang="python">
# The script declares the names a held tag at the root would have taken, the
# markup none of them. The witness is `HeldScriptNamesNative.svelte`.
importjs Child from "./HeldTransitionChild.svelte"

SvelthonSnippet1 = 10
tag = "button"
Selected = Child


def SvelthonSnippet3():
    return 30


@export
def names():
    return [SvelthonSnippet1, SvelthonSnippet3()]
</script>

<svelte:element this={tag} data-k="element" disabled={False}>element</svelte:element>
<Selected />
