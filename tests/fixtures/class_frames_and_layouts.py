# A class statement that raises inside a function, a __dict__ asked in
# __slots__ over several bases, the '__dict__' and '__weakref__' markers in a
# layout, and an __index__ that raises in the bounds of a bytes search.
# `python3` on this module gives the lines the test expects.
__all__ = ["answers"]


class Checked:
    def __init_subclass__(cls, **kw):
        raise TypeError("refused")


def make_checked():
    try:
        class C(Checked):
            pass
    except TypeError as error:
        return str(error)


def run(f):
    try:
        value = f()
    except Exception:
        value = "escaped"
    return value


class Plain:
    pass


class NoSlot:
    __slots__ = ()


class WithX:
    __slots__ = ("x",)


class Markers:
    __slots__ = ("__dict__", "__weakref__")


class Refused:
    def __index__(self):
        raise ValueError("refused")


def answer(question):
    try:
        return repr(question())
    except Exception as error:
        return type(error).__name__


def answers():
    return [answer(one) for one in [
        lambda: run(make_checked),
        lambda: type("B", (NoSlot, Plain), {"__slots__": ("__dict__",)}).__name__,
        lambda: type("B", (Exception,), {"__slots__": ("__dict__",)}),
        lambda: type("B", (Markers, WithX), {}).__name__,
        lambda: b"abc".find(b"a", Refused()),
    ]]


if __name__ == "__main__":
    for line in answers():
        print(line)
