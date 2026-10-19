<script lang="python">
kind: str = "item"
tick: object = None
items = [1.5]


class Box:
    def __init__(self):
        self.x = 1.5


box = Box()


@effect
def normalise():
    tick()
    if kind == "item":
        items[0] = round(items[0], 2)
    elif kind == "item same":
        items[0] = items[0]
    elif kind == "item from the end":
        items[-1] = round(items[-1], 2)
    elif kind == "attribute":
        box.x = round(box.x, 2)
    elif kind == "attribute same":
        box.x = box.x


@derived
def doubled():
    if kind == "derived item":
        items[0] = items[0]
    elif kind == "derived attribute":
        box.x = box.x
    return int(items[0] * 2 + box.x * 2)


@export
def change():
    items[0] = 2.5
    box.x = 2.5
</script>

<output>{items[0]} {box.x} {doubled}</output>
