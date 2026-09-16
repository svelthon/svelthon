# The same data, declared five ways, so the crossing can be compared against the
# one shape that was never in doubt: a class without `__slots__`.
__all__ = [
    "slotted",
    "ordinary",
    "inherited",
    "mixed",
    "partial",
    "shared",
    "empty",
    "unassigned",
    "looks_like_storage",
]


class Slotted:
    __slots__ = ("rows",)

    def __init__(self):
        self.rows = [1]


class Ordinary:
    def __init__(self):
        self.rows = [1]


class Inherited(Slotted):
    # Declares none of its own.
    __slots__ = ()


class Mixed:
    # `__dict__` inside `__slots__` is CPython's marker for "keep the instance
    # dict too", so this one has both kinds of storage at once.
    __slots__ = ("rows", "__dict__")

    def __init__(self):
        self.rows = [1]
        self.label = "both"


class Partial:
    # `later` is never assigned, so it has no storage and is not a field.
    __slots__ = ("rows", "later")

    def __init__(self):
        self.rows = [1]


def slotted():
    return Slotted()


def ordinary():
    return Ordinary()


def inherited():
    return Inherited()


def mixed():
    return Mixed()


def partial():
    return Partial()


class Empty:
    # Declares slots and has none, so nothing is ever stored on an instance.
    __slots__ = ()


class Unassigned:
    # Declares one and never fills it, which is the same thing seen from the
    # object: no storage to be recognised by.
    __slots__ = ("rows",)


def empty():
    return Empty()


def unassigned():
    return Unassigned()


def looks_like_storage():
    # A key of the author's that reads like the engine's storage. Python's side
    # of the control; the JavaScript object is asked of `plainData` directly.
    return {"slot_value_price": 42, "currency": "EUR"}


def shared():
    # The same list reached twice, once through a slot: the graph rule has to
    # hold on this path like any other.
    rows = [1]
    box = Slotted()
    box.rows = rows

    return {"box": box, "rows": rows}
