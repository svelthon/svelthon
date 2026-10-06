# What a module calls itself, and what it gives what it defines.
__all__ = ["report", "fail"]


def plain():
    pass


class Kept:
    def method(self):
        pass


def outer():
    def inner():
        pass

    return inner


def report():
    return [
        __name__,
        globals()["__name__"],
        plain.__module__,
        Kept.__module__,
        Kept.method.__module__,
        type(Kept()).__module__,
        outer().__module__,
        (lambda: 0).__module__,
        repr(Kept).split("'")[1],
    ]


def fail():
    raise ValueError("raised in fail()")
