# A class given new bases reorders its subclasses too. `python3` on this module
# gives the lines the test expects.
__all__ = ["answers"]


class A:
    value = 0


class B:
    value = 1


class C(A):
    pass


class D(C):
    pass


class E(C):
    pass


class F(D, E):
    pass


def answers():
    C.__bases__ = (B,)
    return [repr(D.value), ",".join(k.__name__ for k in F.__mro__)]
