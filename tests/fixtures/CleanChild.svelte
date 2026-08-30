<script lang="python">
# The control: same component, minus the one line that subscribes it to the
# store's shared list.
import leak_store

rows = []


def on_mount():
    leak_store.live.append(1)


def on_destroy():
    leak_store.live.pop()
</script>

<p>child, reading a list of {len(rows)} rows</p>
