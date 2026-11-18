<script lang="python">
# A class attribute the first paragraph reads, through the class, a subclass or
# an instance, and the second one's expression writes, while the page renders.
# Read by a call, which Svelte holds in a derived and runs before the effect
# that renders the page, so it is painted before the second one writes; read
# as it is, it is painted after (`painted` False).
reader: str = "class"
painted: bool = True


class Box:
    label = "a"


class Sub(Box):
    pass


box = Box()


def calculate():
    Box.label = "b"
    return Box.label


def shown():
    return Box.label if reader == "class" else Sub.label if reader == "subclass" else box.label
</script>

{#if painted}<p>{shown()}</p><p>{calculate()}</p>{:else}<p>{Box.label}</p><p>{calculate()}</p>{/if}
