<script lang="python">
import globals_written_store as store


@export
def write(value):
    store.write(value)
</script>

<p data-k="view">{store.doubled}|{store.read()}|{store.future}|{store.absent()}</p>
