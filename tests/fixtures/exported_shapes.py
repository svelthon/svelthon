# A module exporting a class, which `__all__` is entitled to name: it is Python's
# own declaration of what a module exports, read by `from m import *` long before
# anything of ours reads it.
__all__ = ["Widget", "LIMIT", "build", "registry", "pair"]

LIMIT = 10


class Widget:
    def __init__(self, n):
        self.n = n

    def twice(self):
        return self.n * 2


def build(cls, n):
    return cls(n).twice()


# The same class one level down, which is how a route hands a page its model.
# `pyExport` knew what a class was at the top level and `plainData` did not, so
# these two came out as {__qualname__, __doc__, __module__} and were not
# callable.
registry = {"widget": Widget}
pair = [Widget, 2]
