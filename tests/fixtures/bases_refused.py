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


def answers():
    return [
        refused(lambda C: ()),
        refused(lambda C: (1,)),
        refused(lambda C: (C,)),
        refused(lambda C: (object,)),
        refused(lambda C: (M,)),
    ]
