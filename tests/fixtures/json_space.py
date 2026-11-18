# The space `to_json` can be handed, built where these values are ordinary.
#
# Half of them cannot be made from JavaScript at all — `range` and `complex`
# have no `$factory` — and that is the reason a probe written in JavaScript kept
# missing them: the enumeration was of the shapes I could construct, not of the
# shapes an author can pass.
__all__ = ["shapes"]


class Box:
    def __init__(self):
        self.n = 1


class Money(complex):
    # A domain type derived from a builtin, which is the ordinary way to name
    # one. Its number is its value; a field on it is a label beside it.
    pass


class Tagged(complex):
    def __init__(self, *args):
        self.label = "kept"


class Failure(Exception):
    pass


class Stamp(float):
    pass


class Label(str):
    pass


class Count(int):
    pass


TABLE = {
    # No JSON, in CPython either.
    "range": range(3),
    "complex": complex(1, 2),
    "bytes": b"hi",
    "bytearray": bytearray(b"hi"),
    "memoryview": memoryview(b"hi"),
    "frozenset": frozenset([1]),
    # Derived from a builtin with no JSON, which is still that builtin: the
    # number is the value, and a field on it is a label beside it, not instead
    # of it.
    "complex subclass": Money(1, 2),
    "complex subclass with a field": Tagged(1, 2),
    "exception subclass": Failure("gone"),
    # Scalars and their subclasses, which do have JSON and must keep it.
    "float subclass": Stamp(1.5),
    "str subclass": Label("hi"),
    "int subclass": Count(2),
    # JSON, and the controls without which refusing everything would pass.
    "dict": {"a": 1},
    "list": [1, 2],
    "tuple": (1, 2),
    "text": "hi",
    "instance": Box(),
}


def shapes(name):
    return TABLE[name]
