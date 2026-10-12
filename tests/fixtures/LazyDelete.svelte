<script lang="python">
# A derived runs when its value is read, and only then: deleting its name
# reads no value.
@derived
def dangerous():
    raise ValueError("derived should stay lazy")


@export
def drop():
    global dangerous
    del dangerous
    return "deleted"
</script>

<p>ready</p>
