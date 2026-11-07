<script lang="python">
# Held `<svelte:element>`s inside an `<svg>`, a `<foreignObject>` and a
# `<math>`, at the root and in a block. The witness is
# `HeldNamespacesNative.svelte`.
tag = "rect"
item = "mi"
inner = "div"
attrs = {"width": 20}
hidden = False
show = True


@export
def swap():
    global tag
    tag = "circle" if tag == "rect" else "rect"


@export
def toggle():
    global show
    show = not show
</script>

<svg><svelte:element this={tag} data-k="direct" {**attrs}></svelte:element></svg>
<div><svg><g><svelte:element this={tag} data-k="deep" hidden={hidden}></svelte:element></g></svg></div>
<svg><foreignObject><svelte:element this={inner} data-k="foreign" hidden={hidden}></svelte:element></foreignObject></svg>
<math><svelte:element this={item} data-k="math" {**attrs}></svelte:element></math>
<svg>
    <svelte:element this={tag} data-k="outer" {**attrs}>
        <svelte:element this={"title"} data-k="nested" hidden={hidden}></svelte:element>
    </svelte:element>
</svg>
{#if show}
    <svg><g><svelte:element this={tag} data-k="block" {**attrs}></svelte:element></g></svg>
    <ul><li><svelte:element this={inner} data-k="listed" hidden={hidden}></svelte:element></li></ul>
{/if}
