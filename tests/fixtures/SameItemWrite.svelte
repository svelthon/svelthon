<script lang="python">
kind: str = "item"
tick: object = None
items = [1.5]


class Box:
    def __init__(self):
        self.x = 1.5


box = Box()


# A class writing its attributes itself, normalising what it stores, as a
# setter of Svelte's normalises into its state.
class Kept:
    def __init__(self):
        self.x = 1.5

    def __setattr__(self, name, value):
        object.__setattr__(self, name, round(value, 2))


kept = Kept()


# And the same, storing it through a property, in a slot, or in a dict of its
# own that `__getattr__` reads.
class ByProperty:
    def __init__(self):
        self.x = 1.5

    @property
    def x(self):
        return self._x

    @x.setter
    def x(self, value):
        self._x = round(value, 2)

    def __setattr__(self, name, value):
        object.__setattr__(self, name, value)


class InSlot:
    __slots__ = ("x",)

    def __init__(self):
        self.x = 1.5

    def __setattr__(self, name, value):
        object.__setattr__(self, name, round(value, 2))


class Aside:
    def __init__(self):
        object.__setattr__(self, "_data", {})
        self.x = 1.5

    def __setattr__(self, name, value):
        self._data[name] = round(value, 2)

    def __getattr__(self, name):
        try:
            return self._data[name]
        except KeyError:
            raise AttributeError(name)


by_property = ByProperty()
in_slot = InSlot()
aside = Aside()


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
    elif kind == "own attribute":
        kept.x = kept.x
    elif kind == "own property":
        by_property.x = by_property.x
    elif kind == "own slot":
        in_slot.x = in_slot.x
    elif kind == "own dict":
        aside.x = aside.x


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
    kept.x = 2.5
    by_property.x = 2.5
    in_slot.x = 2.5
    aside.x = 2.5
</script>

<output>{items[0]} {box.x} {doubled}</output>
