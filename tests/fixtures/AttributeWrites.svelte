<script lang="python">
# An attribute written or deleted through the type's own method, in place or
# kept as a value, is the write `box.value = 1` makes: the page follows it.
class Box:
    def __init__(self):
        self.value = 0


box = Box()


def by_assignment():
    box.value = 1


def by_builtin():
    setattr(box, "value", 2)


def by_object():
    object.__setattr__(box, "value", 3)


def by_kept():
    put = object.__setattr__
    put(box, "value", 4)


def by_delete():
    object.__delattr__(box, "value")
</script>

<button data-k="assignment" onclick={by_assignment}>a</button>
<button data-k="builtin" onclick={by_builtin}>b</button>
<button data-k="object" onclick={by_object}>o</button>
<button data-k="kept" onclick={by_kept}>k</button>
<button data-k="delete" onclick={by_delete}>d</button>
<output data-k="value">{getattr(box, "value", "absent")}</output>
