<script module>
import { record } from './lifecycle_log.js';
</script>
<script lang="python">
# An `on_mount` that answers a generator, not a cleanup: Svelte reads no
# cleanup there, and nothing walks it.
def lazy():
    record("walked")
    yield 42


def on_mount():
    record("mounted")
    return lazy()
</script>

<p>mounted</p>
