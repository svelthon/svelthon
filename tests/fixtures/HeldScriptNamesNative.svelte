<script>
    // Svelte's witness for HeldScriptNames.svelte.
    import Child from './HeldTransitionChild.svelte';

    const SvelthonSnippet1 = 10;
    let tag = $state('button');
    let Selected = $state(Child);

    function SvelthonSnippet3() {
        return 30;
    }

    export function names() {
        return [SvelthonSnippet1, SvelthonSnippet3()];
    }
</script>

<svelte:element this={tag} data-k="element" disabled={false}>element</svelte:element>
<Selected />
