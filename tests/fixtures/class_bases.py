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


class E(A):
    pass


def bound(slots, namespace):
    try:
        return type("P", (), {"__slots__": slots, **namespace}).__name__
    except ValueError as error:
        return str(error)


class E(A):
    pass


def bound(slots, namespace):
    try:
        return type("P", (), {"__slots__": slots, **namespace}).__name__
    except ValueError as error:
        return str(error)


def made_on(base, slots):
    try:
        return type("C", (base,), {"__slots__": slots}).__name__
    except TypeError as error:
        return str(error)


def answers():
    return [
        made((A, A)),
        made((list, dict)),
        made((A, list)),
        made((A, E)),
        bound(("x",), {"x": 1}),
        made_on(tuple, ("x",)),
        made((A, E)),
        bound(("x",), {"x": 1}),
        slotted(("x,y",)),
        slotted((1,)),
        slotted(("__dict__", "__dict__")),
        slotted("xy"),
    ]
