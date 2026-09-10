# A module exporting a class, which `__all__` is entitled to name: it is Python's
# own declaration of what a module exports, read by `from m import *` long before
# anything of ours reads it.
__all__ = ["Widget", "LIMIT", "build"]

LIMIT = 10


class Widget:
    def __init__(self, n):
        self.n = n

    def twice(self):
        return self.n * 2


def build(cls, n):
    return cls(n).twice()
