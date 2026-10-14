<script lang="python">
# A call that changes nothing of its own, while the author's code it runs, a
# member's `__eq__` or a key's `__hash__`, changes the container.
kind: str = "set add"
armed = False


class Member:
    def __hash__(self):
        return 1

    def __eq__(self, other):
        if type(other) is int and other == 1:
            flags.remove(2)
            flags.add(3)
            return kind == "set add"
        return False

    def __str__(self):
        return "key"


class Key:
    def __hash__(self):
        if armed:
            table.update({"shown": "new"})
        return 7


flags = {Member(), 2}
key = Key()
table = {"shown": "old", key: "yes"}
armed = True


@export
def change():
    try:
        if kind == "set add":
            flags.add(1)
        elif kind == "set discard":
            flags.discard(1)
        elif kind == "set remove":
            flags.remove(1)
        elif kind == "dict setdefault":
            table.setdefault(key, "no")
        else:
            table.pop(Key(), "absent")
    except KeyError:
        pass
</script>

<output>{",".join(sorted(str(one) for one in flags))}|{table["shown"]}</output>
