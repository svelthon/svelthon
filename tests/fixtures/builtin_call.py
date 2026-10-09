# A builtin held as a class's `__call__`, called as Python calls it, and a
# number's `conjugate()`. `python3` on this module gives the lines the test
# expects.
__all__ = ["answers"]


def answers():
    rows = [1, 2]
    out = []

    class Clearer:
        __call__ = rows.clear

    class Length:
        __call__ = len

    class FromKeys:
        __call__ = dict.fromkeys

    class Upper:
        __call__ = "abc".upper

    out.append(repr((Clearer()(), rows)))
    out.append(repr(Length()([1, 2])))
    out.append(repr(FromKeys()(["a"])))
    out.append(repr(Upper()()))
    out.append(repr(((3).conjugate(), True.conjugate(), (0.25).conjugate())))
    return out
