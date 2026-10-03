<script lang="python">
import leak_store


def shared(fn):
    return leak_store.rows


# The shared list in a name a `def` bound first: the cell subscribes as any
# name's does, and has to sign off the same way.
@shared
def rows():
    return None


def on_mount():
    leak_store.live.append(1)


def on_destroy():
    leak_store.live.pop()
</script>

<p>child, holding a list of {len(rows)} rows where a def stood</p>
