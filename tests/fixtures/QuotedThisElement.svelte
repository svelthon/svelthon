<script lang="python">
# A `<svelte:element>` whose `this` is a lone interpolation between quotes, on
# a tag holding an attribute of the boolean table, which asks as it renders
# whether the name it reads makes a custom element.
tag = "p"
empty = []
</script>

<svelte:element this="{tag}" data-k="quoted-this" hidden={empty}>x</svelte:element>
