<script lang="python">
# A class attribute the first paragraph reads, through the class, a subclass or
# an instance, and the second one's expression writes, while the page renders.
reader: str = "class"


class Box:
    label = "a"


class Sub(Box):
    pass


box = Box()


def calculate():
    Box.label = "b"
    return Box.label
</script>

<p>{Box.label if reader == "class" else Sub.label if reader == "subclass" else box.label}</p>
<p>{calculate()}</p>
