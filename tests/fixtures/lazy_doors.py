# An iterable made as it goes, handed by a Python component to a Python one:
# the reader holds the very object, untouched.
__all__ = ["make", "seen"]

HANDED = {}


def numbers():
    yield 1
    yield 2
    yield 3


def make(kind):
    if kind == "generator":
        value = numbers()
    elif kind == "iterator":
        value = iter([1, 2, 3])
    else:
        value = range(1, 4)
    HANDED[kind] = value
    return value


def seen(kind, value):
    return f"{type(value).__name__} same={value is HANDED[kind]} {list(value)}"
