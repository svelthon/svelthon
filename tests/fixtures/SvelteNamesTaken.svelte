<script lang="python">
# Names the engine imports from Svelte for its own use, taken by the author:
# an import of Svelte's own, and a `def` of theirs. Each is theirs, and the
# engine's contexts and hooks go on working beside them.
importjs { untrack, setContext } from "svelte"

count = 1
mounted = 0
read = 0
set_context("key", "value")
found = get_context("key")


def getContext():
    return "own"


def on_mount():
    global mounted, read
    mounted += 1
    read = untrack(lambda: count)
</script>

<p>{mounted}|{read}|{getContext()}|{found}|{setContext is not None}</p>
