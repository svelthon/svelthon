<script lang="python">
# An int arriving from JavaScript as a BigInt, `1n`, is the int Python finds
# equal to `1`: as a key it keeps the block, and a context set under it is
# found under the other.
start: int = 1
incoming: int = 1
key = start
set_context(incoming, "kept")
found = get_context(start)


@export
def equal():
    return key == incoming


@export
def change():
    global key
    key = incoming
</script>

{#key key}<input value="draft" />{/key}
<p>{found}</p>
