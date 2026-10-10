# Bases a class refuses, the one it lays out on, and the slot names it
# refuses. `python3` on this module gives the lines the test expects.
__all__ = ["answers"]


class A:
    pass


def made(bases):
    try:
        return type("X", bases, {}).__base__.__name__
    except TypeError as error:
        return str(error)


def slotted(slots):
    try:
        return type("P", (), {"__slots__": slots}).__name__
    except TypeError as error:
        return str(error)


def answers():
    return [
        made((A, A)),
        made((list, dict)),
        made((A, list)),
        slotted(("x,y",)),
        slotted((1,)),
        slotted(("__dict__", "__dict__")),
        slotted("xy"),
    ]
