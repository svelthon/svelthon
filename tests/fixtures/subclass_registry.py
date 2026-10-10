# What a class's `__subclasses__()` lists: a class written with no base under
# `object`, and a class given new bases moved from the old ones to the new,
# unless the assignment is refused, which leaves everything as it was.
# `python3` on this module gives the lines the test expects.
__all__ = ["answers"]


class Implicit:
    pass


class A:
    pass


class B:
    pass


class X(B):
    pass


class Z(A, X):
    pass


class Y(B):
    pass


def answers():
    try:
        X.__bases__ = (A,)
        refused = "accepted"
    except TypeError:
        refused = "TypeError"
    Y.__bases__ = (A,)
    return [
        repr(Implicit in object.__subclasses__()),
        refused,
        ",".join(c.__name__ for c in X.__mro__),
        repr(Y in A.__subclasses__()),
        repr(Y in B.__subclasses__()),
    ]
