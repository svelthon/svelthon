<script lang="python">
# A `__getitem__` that raises its own error: a failure, not an absence.
class Guard:
    def __getitem__(self, key):
        raise ValueError("READ_UNAVAILABLE")

    def __setitem__(self, key, value):
        raise ValueError("WRITE_REFUSED")


obj = Guard()


@export
def model():
    return str(vars(obj))
</script>

<button data-k="write" onclick={lambda: (obj.name := "changed")}>write</button>
<svelte:boundary>
    <p data-k="read">{obj.name}</p>
    {#snippet failed(error)}<p data-k="read">{type(error).__name__}: {str(error)}</p>{/snippet}
</svelte:boundary>
