<script lang="python">
# What a teardown reads after a change that runs its effect again: a name as
# Svelte hands it, the value before; a dict changed in place as it is now; and
# what the run kept for it, what the run saw. Recorded into a JavaScript array
# the test hands over, which no effect follows.
events: object
count = 0
box = {"n": 0}


@effect
def direct():
    events.push(["open", count, box["n"]])
    return lambda: events.push(["clean", count, box["n"]])


@effect
def kept():
    n = box["n"]
    was = count
    return lambda: events.push(["kept", was, n])


@export
def change():
    global count
    count = 1
    box["n"] = 1
</script>

<p>{count}</p>
