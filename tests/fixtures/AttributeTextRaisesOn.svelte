<script lang="python">
way: str = "translate"


class Caption:
    def __str__(self):
        raise ValueError("caption unavailable")


caption = Caption()
tag = "p"
raising = {"translate": caption, "draggable": caption}
chosen = {"translate": "no"}
both = {"translate": "no", "draggable": "false"}
empty = {}
titled = {"title": "kept"}


def made():
    return caption
</script>

{#if way == "translate"}
    <p translate={caption}></p>
{:else if way == "draggable"}
    <p draggable={caption}></p>
{:else if way == "spellcheck"}
    <p spellcheck={caption}></p>
{:else if way == "spread"}
    <p {**raising}></p>
{:else if way == "spread-then-attribute"}
    <p {**raising} title="kept"></p>
{:else if way == "spread-overridden"}
    <p {**raising} translate="no" draggable="false"></p>
{:else if way == "attribute-overridden"}
    <p translate={caption} {**chosen}></p>
{:else if way == "element"}
    <svelte:element this={tag} translate={caption}></svelte:element>
{:else if way == "element-spread"}
    <svelte:element this={tag} {**raising}></svelte:element>
{:else if way == "attribute-then-empty-spread"}
    <p translate={caption} {**empty}></p>
{:else if way == "attribute-then-other-spread"}
    <p translate={caption} {**titled}></p>
{:else if way == "between-spreads"}
    <p {**raising} {**titled}></p>
{:else if way == "element-attribute-then-spread"}
    <svelte:element this={tag} translate={caption} {**empty}></svelte:element>
{:else if way == "spread-overridden-by-spread"}
    <p {**raising} {**both}></p>
{:else if way == "attribute-overridden-two-spreads-on"}
    <p translate={caption} {**chosen} {**empty}></p>
{:else if way == "call-then-spread"}
    <p translate={made()} {**empty}></p>
{/if}
