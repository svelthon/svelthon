# The order globals() lists a module's names in: the order they were bound, a
# value and a function between them; a name bound again keeps its place, and
# one deleted and bound again goes last. Plain Python, so the same file answers
# the same under CPython.
__all__ = ["listed", "moved", "replaced"]
first = 1


def middle():
    return 0


last = 2


def listed():
    mapping = globals()
    views = (mapping, reversed(mapping), mapping.copy())
    return [[name for name in view if name in ("first", "middle", "last")] for view in views]


def moved():
    mapping = globals()
    mapping["first"] = mapping.pop("first")
    return listed()


def replaced():
    globals()["middle"] = 17
    return listed()
