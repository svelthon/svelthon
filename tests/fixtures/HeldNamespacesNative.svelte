<script>
    // Svelte's witness for HeldNamespaces.svelte.
    let tag = $state('rect');
    let item = $state('mi');
    let inner = $state('div');
    let attrs = $state({ width: 20 });
    let hidden = $state(false);
    let show = $state(true);

    export function swap() {
        tag = tag === 'rect' ? 'circle' : 'rect';
    }

    export function toggle() {
        show = !show;
    }
</script>

<svg><svelte:element this={tag} data-k="direct" {...attrs}></svelte:element></svg>
<div><svg><g><svelte:element this={tag} data-k="deep" hidden={hidden}></svelte:element></g></svg></div>
<svg><foreignObject><svelte:element this={inner} data-k="foreign" hidden={hidden}></svelte:element></foreignObject></svg>
<math><svelte:element this={item} data-k="math" {...attrs}></svelte:element></math>
<svg>
    <svelte:element this={tag} data-k="outer" {...attrs}>
        <svelte:element this={'title'} data-k="nested" hidden={hidden}></svelte:element>
    </svelte:element>
</svg>
{#if show}
    <svg><g><svelte:element this={tag} data-k="block" {...attrs}></svelte:element></g></svg>
    <ul><li><svelte:element this={inner} data-k="listed" hidden={hidden}></svelte:element></li></ul>
{/if}
