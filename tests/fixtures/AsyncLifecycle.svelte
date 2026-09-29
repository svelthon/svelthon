<script module>
import { record } from './lifecycle_log.js';
</script>
<script lang="python">
# An effect written as an `async def`, and an `on_mount` that hands back its
# cleanup, as Svelte's `onMount` does.
from browser import aio

count = 0


@effect
async def watch():
    record(f"effect ran {count}")
    await aio.sleep(0)
    record("effect finished")


def on_mount():
    record("mounted")
    return lambda: record("mount cleanup")


def on_destroy():
    record("destroyed")
</script>

<p>{count}</p>
