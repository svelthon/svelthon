# The space `tojson` can be handed, built where these values are ordinary.
#
# Half of them cannot be made from JavaScript at all — `range` and `complex`
# have no `$factory` — and that is the reason a probe written in JavaScript kept
# missing them: the enumeration was of the shapes I could construct, not of the
# shapes an author can pass.
__all__ = ["shapes"]


class Box:
    def __init__(self):
        self.n = 1


TABLE = {
    # No JSON, in CPython either.
    "range": range(3),
    "complex": complex(1, 2),
    "bytes": b"hi",
    "bytearray": bytearray(b"hi"),
    "memoryview": memoryview(b"hi"),
    "frozenset": frozenset([1]),
    # JSON, and the controls without which refusing everything would pass.
    "dict": {"a": 1},
    "list": [1, 2],
    "tuple": (1, 2),
    "text": "hi",
    "instance": Box(),
}


def shapes(name):
    return TABLE[name]
