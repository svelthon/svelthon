<script lang="python">
way: str = "translate"


class Caption:
    def __str__(self):
        raise ValueError("caption unavailable")


caption = Caption()
tag = "p"
raising = {"translate": caption, "draggable": caption}
chosen = {"translate": "no"}
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
{/if}
