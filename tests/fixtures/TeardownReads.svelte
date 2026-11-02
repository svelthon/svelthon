<script lang="python">
# What a teardown reads after a change that runs its effect again: a name as
# Svelte hands it, the value before; a dict, a list and an instance changed in
# place as they are now; what the run kept for it, what the run saw; and a dict
# bound again, the old one. Recorded into a JavaScript array the test hands
# over, which no effect follows.
events: object
count = 0
box = {"n": 0}
other = {"n": 0}
items = [0]


class Holder:
    def __init__(self):
        self.n = 0


held = Holder()


@effect
def direct():
    events.push(["open", count, box["n"]])
    return lambda: events.push(["clean", count, box["n"]])


@effect
def kept():
    n = box["n"]
    was = count
    return lambda: events.push(["kept", was, n])


@effect
def rebound():
    seen = other["n"]
    return lambda: events.push(["rebound", seen, other["n"]])


@effect
def listed():
    seen = len(items)
    return lambda: events.push(["list", seen, len(items)])


@effect
def instance():
    seen = held.n
    return lambda: events.push(["instance", seen, held.n])


@export
def change():
    global count, other
    count = 1
    box["n"] = 1
    other = {**other, "n": 1}
    items.append(1)
    held.n = 1
</script>

<p>{count}</p>
