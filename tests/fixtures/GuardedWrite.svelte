<script lang="python">
# An object that answers the subscript and refuses the write. In a template the
# dot finds the key on the way in, so it has to write the key on the way out —
# and carry back what the write says, rather than looking for somewhere else to
# put the value.
class Guard:
    def __getitem__(self, key):
        return "original"

    def __setitem__(self, key, value):
        raise ValueError("LOCKED")


obj = Guard()
</script>

<!-- The walrus is the template's own write, and what compiles to `writeAttr`. -->
<button data-k="write" onclick={lambda: (obj.name := "changed")}>obj.name := …</button>

<p data-k="dotted">{obj.name}</p>
<p data-k="keyed">{obj["name"]}</p>
