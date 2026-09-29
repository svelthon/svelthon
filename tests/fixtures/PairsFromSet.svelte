<script lang="python">
# A dict fed pairs from a set: the key and the value land in it, not the pair.
# A set holds only what hashes, so the value is an instance.
class Box:
    def __init__(self):
        self.count = 0

    def __repr__(self):
        return f"Box({self.count})"


kind: str = "set"
rows = {}


def make():
    child = Box()

    def install():
        pairs = {("k", child)}
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
