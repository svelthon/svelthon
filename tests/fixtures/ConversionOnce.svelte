<script lang="python">
# A JavaScript collection changed by its own method with a key whose conversion
# is refused.
importjs { makeKey, makeCollection, arm, inspect } from "./conversion_once.js"

kind: str = "set add"

key = makeKey()
held = makeCollection(kind, key)


@export
def run():
    arm()
    if kind == "set add":
        held.add(key)
    elif kind == "map key":
        held.set(key, 1)
    elif kind == "map value":
        held.set("x", key)
    else:
        held.delete(key)


@export
def model():
    return inspect()
</script>

<output>{len(kind)}</output>
