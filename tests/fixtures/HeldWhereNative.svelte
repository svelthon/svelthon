<script>
    // Svelte's witness for HeldWhere.svelte.
    import { choose, shape } from './held_reads.js';

    let outer = $state(undefined);
    let attrs = $state({ width: 20 });

    export function show(tag) {
        outer = tag;
    }
</script>

{#if true}
    <svelte:element this={outer} data-k="outer">
        <svelte:element this={choose()} data-k="block" disabled></svelte:element>
    </svelte:element>
{/if}
{#snippet held()}
    <svelte:element this={outer} data-k="held"><svelte:element this={choose()} data-k="snippet" disabled></svelte:element></svelte:element>
{/snippet}
{@render held()}
{#if true}
    <div>
        {#snippet content()}hello{/snippet}
        <svelte:element this={shape(content, 'span')} data-k="scoped" disabled>{@render content()}</svelte:element>
    </div>
{/if}
<svg>
    {#snippet mark()}m{/snippet}
    <svelte:element this={shape(mark, 'rect')} data-k="drawn" {...attrs}></svelte:element>
</svg>
