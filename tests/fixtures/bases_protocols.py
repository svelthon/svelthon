# What a class and its subclass call and iterate once given new bases, the
# old ones read first. `python3` on this module gives the lines the test
# expects.
__all__ = ["answers"]


class A:
    def __call__(self):
        return "A"

    def __iter__(self):
        return iter("A")


class B:
    def __call__(self):
        return "B"

    def __iter__(self):
        return iter("B")


class C(A):
    pass


class D(C):
    pass


def answers():
    C()(), D()(), list(C()), list(D())
    C.__bases__ = (B,)
    return [C.__base__.__name__, C()(), D()(), "".join(C()), "".join(D())]
