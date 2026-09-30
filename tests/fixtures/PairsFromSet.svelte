<script lang="python">
# A dict fed pairs from a set: the key and the value land in it, not the pair.
# A set holds only what hashes, so the value is an instance. And pairs that are
# objects of the author's, which say through `__iter__` what they give.
class Box:
    def __init__(self):
        self.count = 0

    def __repr__(self):
        return f"Box({self.count})"


class Pair:
    def __init__(self, child):
        self.child = child

    def __iter__(self):
        return iter(["k", self.child])


kind: str = "set"
rows = {}


def make():
    child = Box()

    def install():
        pairs = {("k", child)}
        if kind == "custom":
            rows.update([Pair(child)])
        elif kind == "custom-or":
            rows.__ior__([Pair(child)])
        else:
            rows.update(pairs if kind == "set" else frozenset(pairs))

    def grow():
        child.count += 1

    return [install, grow]


made = make()
install = made[0]
grow = made[1]
</script>

<button data-k="install" onclick={install}>install</button>
<button data-k="grow" onclick={grow}>grow</button>
<p>{rows}</p>
