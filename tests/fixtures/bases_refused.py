# New bases CPython refuses, each before anything changes. `python3` on this
# module gives the lines the test expects.
__all__ = ["answers"]


class A:
    pass


class M(list):
    pass


def refused(bases):
    class C(A):
        pass

    try:
        C.__bases__ = bases(C)
    except TypeError as error:
        return f"{error} | {C.__bases__[0].__name__} {C in A.__subclasses__()}"
    return "accepted"


# Instances laid out alike whatever the order or the spelling of the slots
# declared, and apart when the names differ.
def swapped(slots_a, slots_b):
    A = type("A", (), {} if slots_a is None else {"__slots__": slots_a})
    B = type("B", (), {} if slots_b is None else {"__slots__": slots_b})
    C = type("C", (A,), {"__slots__": ()})
    try:
        C.__bases__ = (B,)
    except TypeError as error:
        return str(error)
    return "accepted"


def answers():
    return [
        refused(lambda C: ()),
        refused(lambda C: (1,)),
        refused(lambda C: (C,)),
        refused(lambda C: (object,)),
        refused(lambda C: (M,)),
        swapped(("x", "y"), ("y", "x")),
        swapped(("__dict__", "__weakref__"), None),
        swapped({"x": None}, {"y": None}),
    ]
