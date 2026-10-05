<svelte:options customElement={{ tag: "quoted-header-element", shadow: "none" }} />

<script generics="T extends Map<string, number>" lang="python">
# The written-out form of the option, read by Svelte's parser over the file
# with the script's body blanked, and a `>` inside a quoted value of the tag.
start: int = 0
</script>

<p class="quoted-header">{start + 1}</p>
