<svelte:options customElement={{ tag: "closing-prefix-element", shadow: "none" }} />

<script lang="python">
# A string and a comment that begin like the closing tag and are not one: the
# props are read off the whole body all the same, types included.
note = "</scriptx>"
# </script-not-a-tag>
start: int = 0
</script>

<p class="closing-prefix">{start + 1}|{type(start).__name__}</p>
