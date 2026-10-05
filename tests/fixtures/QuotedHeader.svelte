<script generics="T extends Map<string, number>" lang="python">
# A `>` inside a quoted value of the tag, ahead of `lang`: the template is
# Python's all the same, and an empty list is false.
rows = []
</script>

<p>{#if rows}yes{:else}no{/if}</p>
