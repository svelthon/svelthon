<script lang="python">
# The same attributes written twice: gathered into a dict, and again on the
# element beside it. Gathering them must not change what they mean.
presses = 0
attrs = {"title": "set", "disabled": True}

# The values a spread has no business converting. Each one is read back as
# itself: the empty string is an attribute that is there and says nothing, and
# False is the word "false", neither of which is absence.
def press():
    global presses
    presses += 1

def erase():
    global attrs
    attrs = {"title": None, "disabled": None}

kept = {"title": "", "data-n": 0, "aria-hidden": False, "onclick": press}
</script>

<input data-k="spread" {**attrs} />
<input data-k="direct" title={attrs["title"]} disabled={attrs["disabled"]} />
<a data-k="link" {**attrs}>link</a>
<svelte:element this={"a"} data-k="element" disabled={attrs["disabled"]}>element</svelte:element>
<button data-k="kept" {**kept}>keep</button>
<button data-k="erase" onclick={erase}>erase</button>
<p data-k="presses">{presses}</p>
