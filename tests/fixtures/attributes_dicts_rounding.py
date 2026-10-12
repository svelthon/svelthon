# hasattr() on a property that fails, the copy and the update of a dict
# subclass, round() on ints, floats and their subclasses, isinstance() with a
# proxy and with a list, the state of an iterator, and __slots__ asking for a
# __dict__ a base gives. `python3` on this module gives the lines the test
# expects.
__all__ = ["answers"]


class Config:
    @property
    def value(self):
        raise RuntimeError("cannot read")


class Settings(dict):
    pass


class Selected(dict):
    def __iter__(self):
        return iter(["b"])

    def keys(self):
        return ["b"]


class Incomplete:
    def keys(self):
        return ["a"]


class Measurement(float):
    def __round__(self, ndigits=None):
        return ("custom", ndigits)


class Digits:
    def __index__(self):
        return 1


class Proxy:
    @property
    def __class__(self):
        return int


class Plain:
    pass


def updated(*args):
    result = {"before": 0}
    result.update(*args)
    return result


def restored():
    it = iter([1, 2])
    it.__setstate__(Digits())


def answer(question):
    try:
        return repr(question())
    except Exception as error:
        return type(error).__name__


def answers():
    return [answer(one) for one in [
        lambda: hasattr(Config(), "value"),
        lambda: Settings(a=1, b=2).copy(),
        lambda: updated(Selected(a=1, b=2)),
        lambda: updated(Incomplete()),
        lambda: updated({"a": 1}, {"b": 2}),
        lambda: (round(1234, -2), round(2 ** 53 + 1), round(2.675, 2), round(2.5, 0)),
        lambda: (round(Measurement(1.25), 1), round(1.25, Digits())),
        lambda: isinstance(Proxy(), int),
        lambda: isinstance(1, [int]),
        restored,
        lambda: type("B", (Plain,), {"__slots__": ("__dict__",)}),
    ]]


if __name__ == "__main__":
    for line in answers():
        print(line)
