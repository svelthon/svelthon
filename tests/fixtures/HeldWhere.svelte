<script lang="python">
# Held tags under a dynamic parent that renders nothing, in a block and in a
# snippet, and beside a snippet their element declares, in a `<div>` and in an
# `<svg>`. The witness is `HeldWhereNative.svelte`.
importjs { choose, shape } from "./held_reads.js"

outer = None
attrs = {"width": 20}


@export
def show(tag):
    global outer
    outer = tag
</script>

{#if True}
    <svelte:element this={outer} data-k="outer">
        <svelte:element this={choose()} data-k="block" disabled></svelte:element>
    </svelte:element>
{/if}
{#snippet held()}
    <svelte:element this={outer} data-k="held"><svelte:element this={choose()} data-k="snippet" disabled></svelte:element></svelte:element>
{/snippet}
{@render held()}
{#if True}
    <div>
        {#snippet content()}hello{/snippet}
        <svelte:element this={shape(content, "span")} data-k="scoped" disabled>{@render content()}</svelte:element>
    </div>
{/if}
<svg>
    {#snippet mark()}m{/snippet}
    <svelte:element this={shape(mark, "rect")} data-k="drawn" {**attrs}></svelte:element>
</svg>
