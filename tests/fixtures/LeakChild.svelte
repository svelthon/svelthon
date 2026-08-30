<script lang="python">
import leak_store

# Reading the shared list is what subscribes this component to it.
rows = leak_store.rows


def on_mount():
    leak_store.live.append(1)


def on_destroy():
    leak_store.live.pop()
</script>

<p>child, reading a list of {len(rows)} rows</p>
