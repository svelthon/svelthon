<script lang="python">
# An action whose `update` puts new callbacks in the dict it returned. The
# witness is `ActionDictLiveNative.svelte`.
importjs { acquire } from "./action_resources.js"

value = 0


def act(node, given):
    close = acquire(given)
    payload = {"destroy": close}

    def update(next):
        nonlocal close
        close()
        close = acquire(next)
        payload["destroy"] = close

    payload["update"] = update
    return payload


@export
def bump():
    global value
    value += 1
</script>

<p use:act={value}>{value}</p>
